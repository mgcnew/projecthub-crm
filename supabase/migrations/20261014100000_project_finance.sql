-- Etapa 1 do financeiro (D093): valor do projeto e parcelas (adiantamento, parcelas, saldo) com vencimento
-- e situação. É controle de RECEBÍVEIS por projeto, não contabilidade. Dinheiro em centavos inteiros;
-- a moeda é do projeto (nunca se soma moedas diferentes). "Atrasado" é derivado na leitura (vencida e a
-- receber, no fuso de trabalho); não é coluna.

alter table public.projects
  add column contract_value_cents bigint check (contract_value_cents is null or contract_value_cents >= 0),
  add column currency text not null default 'BRL' check (currency in ('BRL', 'USD', 'EUR')),
  add column billing_model text not null default 'fixed' check (billing_model in ('fixed', 'hourly', 'monthly'));

grant insert (contract_value_cents, currency, billing_model) on public.projects to authenticated;
grant update (contract_value_cents, currency, billing_model) on public.projects to authenticated;

create table public.project_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid not null,
  kind text not null default 'installment' check (kind in ('advance', 'installment', 'final', 'other')),
  description text check (description is null or char_length(description) <= 200),
  amount_cents bigint not null check (amount_cents > 0),
  due_date date not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled')),
  paid_on date,
  payment_method text check (payment_method is null or char_length(payment_method) <= 60),
  invoice_number text check (invoice_number is null or char_length(invoice_number) <= 60),
  notes text check (notes is null or char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  -- Recebida ⇔ tem a data em que caiu.
  check ((status = 'paid') = (paid_on is not null)),
  foreign key (organization_id, project_id) references public.projects (organization_id, id)
);

create index project_payments_org_project_idx on public.project_payments (organization_id, project_id, due_date);
create index project_payments_org_pending_idx on public.project_payments (organization_id, due_date) where status = 'pending';

create trigger project_payments_set_updated_at before update on public.project_payments
  for each row execute function private.set_updated_at();

-- A moeda de um projeto com parcelas não muda (os valores deixariam de fazer sentido).
create function private.projects_currency_lock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.currency is distinct from old.currency
     and exists (
       select 1 from public.project_payments p
        where p.organization_id = old.organization_id and p.project_id = old.id
     ) then
    raise exception 'cannot change the currency of a project that has payments' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger projects_currency_lock before update of currency on public.projects
  for each row execute function private.projects_currency_lock();

revoke all on function private.projects_currency_lock() from public, anon, authenticated;

revoke all on public.project_payments from public, anon, authenticated;
grant select on public.project_payments to authenticated;
grant insert (organization_id, project_id, kind, description, amount_cents, due_date, status, paid_on,
              payment_method, invoice_number, notes)
  on public.project_payments to authenticated;
grant update (kind, description, amount_cents, due_date, status, paid_on, payment_method, invoice_number, notes)
  on public.project_payments to authenticated;
grant delete on public.project_payments to authenticated;

alter table public.project_payments enable row level security;

create policy project_payments_select_member on public.project_payments
  for select to authenticated using (private.is_active_member(organization_id));
create policy project_payments_insert_owner on public.project_payments
  for insert to authenticated with check (private.is_active_owner(organization_id));
create policy project_payments_update_owner on public.project_payments
  for update to authenticated
  using (private.is_active_owner(organization_id))
  with check (private.is_active_owner(organization_id));
-- Parcela recebida é histórico: para corrigir, volta para "a receber" antes de excluir.
create policy project_payments_delete_owner on public.project_payments
  for delete to authenticated
  using (private.is_active_owner(organization_id) and status <> 'paid');

create policy mfa_required on public.project_payments as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

-- Valores e moeda do projeto não entram na trilha de atividade (só a lista de colunas ignoradas muda; o
-- restante da função é idêntico ao de 20261013160000).
create or replace function private.log_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type text := tg_argv[0];
  v_new jsonb := to_jsonb(new);
  v_old jsonb;
  v_changes jsonb;
  v_action text;
  -- Colunas derivadas, imutáveis ou sensíveis que não contam como alteração na trilha.
  v_ignore text[] := array['updated_at', 'created_at', 'completed_at', 'organization_id', 'id', 'priority_rank',
                           'contract_value_cents', 'currency', 'billing_model'];
  -- Texto longo: registra apenas que mudou.
  v_long text[] := array['description', 'notes'];
begin
  if v_type = 'calendar_event' and v_new->>'event_type' = 'work_block' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    insert into public.activity_logs (organization_id, actor_id, entity_type, entity_id, action, changes)
    values (
      new.organization_id, auth.uid(), v_type, new.id, 'created',
      jsonb_build_object('title', coalesce(v_new->>'title', v_new->>'name'))
    );
    return new;
  end if;

  v_old := to_jsonb(old);
  select coalesce(jsonb_object_agg(
           n.key,
           case when n.key = any (v_long)
                then jsonb_build_object('changed', true)
                else jsonb_build_object('from', o.value, 'to', n.value)
           end), '{}'::jsonb)
    into v_changes
    from jsonb_each(v_new) n
    join jsonb_each(v_old) o on o.key = n.key
   where n.value is distinct from o.value
     and n.key <> all (v_ignore);

  if v_changes = '{}'::jsonb then
    return new;
  end if;

  v_action := case
    when (v_old->>'archived_at') is null and (v_new->>'archived_at') is not null then 'archived'
    when (v_old->>'archived_at') is not null and (v_new->>'archived_at') is null then 'unarchived'
    when v_changes ? 'status' then 'status_changed'
    else 'updated'
  end;

  insert into public.activity_logs (organization_id, actor_id, entity_type, entity_id, action, changes)
  values (new.organization_id, auth.uid(), v_type, new.id, v_action, v_changes);
  return new;
end;
$$;

revoke all on function private.log_activity() from public, anon, authenticated;

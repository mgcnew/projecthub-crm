-- Etapa 2 (D096): cadastro completo do cliente (dados fiscais, cobrança, endereço, origem) e contatos
-- (várias pessoas por cliente, uma principal). Dados pessoais: ficam fora de activity_logs.

alter table public.clients
  add column legal_name text check (legal_name is null or char_length(legal_name) <= 200),
  add column tax_id text check (tax_id is null or char_length(tax_id) <= 20),
  add column billing_email text check (billing_email is null or (char_length(billing_email) <= 254 and billing_email like '%_@_%')),
  add column website text check (website is null or (char_length(website) <= 2048 and website ~* '^https?://[^[:space:]]+$')),
  add column address_line text check (address_line is null or char_length(address_line) <= 300),
  add column address_city text check (address_city is null or char_length(address_city) <= 100),
  add column address_state text check (address_state is null or char_length(address_state) <= 60),
  add column address_postal_code text check (address_postal_code is null or char_length(address_postal_code) <= 20),
  add column source text check (source is null or char_length(source) <= 100);

grant insert (legal_name, tax_id, billing_email, website, address_line, address_city, address_state,
              address_postal_code, source)
  on public.clients to authenticated;
grant update (legal_name, tax_id, billing_email, website, address_line, address_city, address_state,
              address_postal_code, source)
  on public.clients to authenticated;

create table public.client_contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  client_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  role_title text check (role_title is null or char_length(role_title) <= 100),
  email text check (email is null or (char_length(email) <= 254 and email like '%_@_%')),
  phone text check (phone is null or char_length(phone) <= 40),
  whatsapp text check (whatsapp is null or char_length(whatsapp) <= 40),
  is_primary boolean not null default false,
  notes text check (notes is null or char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, client_id) references public.clients (organization_id, id)
);

create index client_contacts_org_client_idx on public.client_contacts (organization_id, client_id, name);
-- No máximo um contato principal por cliente (a trigger abaixo desmarca o anterior).
create unique index client_contacts_one_primary on public.client_contacts (client_id) where is_primary;

create trigger client_contacts_set_updated_at before update on public.client_contacts
  for each row execute function private.set_updated_at();

create function private.client_contacts_single_primary()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_primary then
    update public.client_contacts c
       set is_primary = false
     where c.organization_id = new.organization_id
       and c.client_id = new.client_id
       and c.id <> new.id
       and c.is_primary;
  end if;
  return new;
end;
$$;

create trigger client_contacts_single_primary before insert or update of is_primary on public.client_contacts
  for each row execute function private.client_contacts_single_primary();

revoke all on function private.client_contacts_single_primary() from public, anon, authenticated;

revoke all on public.client_contacts from public, anon, authenticated;
grant select on public.client_contacts to authenticated;
grant insert (organization_id, client_id, name, role_title, email, phone, whatsapp, is_primary, notes)
  on public.client_contacts to authenticated;
grant update (name, role_title, email, phone, whatsapp, is_primary, notes) on public.client_contacts to authenticated;
-- Sem histórico de negócio (como acessos e modelos): remoção definitiva permitida.
grant delete on public.client_contacts to authenticated;

alter table public.client_contacts enable row level security;

create policy client_contacts_select_member on public.client_contacts
  for select to authenticated using (private.is_active_member(organization_id));
create policy client_contacts_insert_owner on public.client_contacts
  for insert to authenticated with check (private.is_active_owner(organization_id));
create policy client_contacts_update_owner on public.client_contacts
  for update to authenticated
  using (private.is_active_owner(organization_id))
  with check (private.is_active_owner(organization_id));
create policy client_contacts_delete_owner on public.client_contacts
  for delete to authenticated using (private.is_active_owner(organization_id));

create policy mfa_required on public.client_contacts as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

-- Dados pessoais e de cobrança fora da trilha de atividade (só a lista ignorada muda; o restante da função é
-- idêntico ao de 20261014100000).
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
  -- Colunas derivadas, imutáveis ou sensíveis (financeiro, documento fiscal, endereço, e-mail de cobrança).
  v_ignore text[] := array['updated_at', 'created_at', 'completed_at', 'organization_id', 'id', 'priority_rank',
                           'contract_value_cents', 'currency', 'billing_model',
                           'tax_id', 'billing_email', 'address_line', 'address_city', 'address_state',
                           'address_postal_code'];
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

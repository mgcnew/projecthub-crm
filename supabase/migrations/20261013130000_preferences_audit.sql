-- Fase 6: preferências pessoais (fuso) e trilha de atividades.
-- user_preferences guarda só o fuso de trabalho (D054); locale, tema e layout ficam fora (D008).
-- activity_logs é imutável para o cliente: gravado por trigger SECURITY DEFINER (D055).

-- ----------------------------------------------------------- user_preferences
create table public.user_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  timezone text not null,
  updated_at timestamptz not null default now()
);

create function private.user_preferences_validate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_valid_timezone(new.timezone) then
    raise exception 'invalid timezone: %', new.timezone using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger user_preferences_validate
  before insert or update on public.user_preferences
  for each row execute function private.user_preferences_validate();

create trigger user_preferences_set_updated_at before update on public.user_preferences
  for each row execute function private.set_updated_at();

-- ------------------------------------------------------------- activity_logs
create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  entity_type text not null check (entity_type in ('task', 'project', 'client', 'calendar_event')),
  entity_id uuid not null,
  action text not null check (action in ('created', 'updated', 'status_changed', 'archived', 'unarchived')),
  -- created: {"title": ...}; demais: {coluna: {"from": x, "to": y}} (texto longo: {"changed": true}).
  changes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index activity_logs_entity_idx
  on public.activity_logs (organization_id, entity_type, entity_id, created_at desc);
create index activity_logs_org_created_idx on public.activity_logs (organization_id, created_at desc);

-- Registra criação e alterações relevantes. Ignora ruído (timestamps derivados, work blocks) e
-- UPDATEs sem diferença visível. TG_ARGV[0] = entity_type.
create function private.log_activity()
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
  -- Colunas derivadas ou imutáveis que não contam como alteração.
  v_ignore text[] := array['updated_at', 'created_at', 'completed_at', 'organization_id', 'id'];
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

create trigger tasks_log_activity after insert or update on public.tasks
  for each row execute function private.log_activity('task');
create trigger projects_log_activity after insert or update on public.projects
  for each row execute function private.log_activity('project');
create trigger clients_log_activity after insert or update on public.clients
  for each row execute function private.log_activity('client');
create trigger calendar_events_log_activity after insert or update on public.calendar_events
  for each row execute function private.log_activity('calendar_event');

revoke all on function private.user_preferences_validate() from public, anon, authenticated;
revoke all on function private.log_activity() from public, anon, authenticated;

-- ------------------------------------------------------------------ grants
revoke all on public.user_preferences, public.activity_logs from public, anon, authenticated;
grant select on public.user_preferences, public.activity_logs to authenticated;
grant insert (user_id, timezone) on public.user_preferences to authenticated;
grant update (timezone) on public.user_preferences to authenticated;

-- --------------------------------------------------------------------- RLS
alter table public.user_preferences enable row level security;
alter table public.activity_logs enable row level security;

create policy user_preferences_select_own on public.user_preferences for select to authenticated
  using (user_id = (select auth.uid()));
create policy user_preferences_insert_own on public.user_preferences for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy user_preferences_update_own on public.user_preferences for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Trilha visível a qualquer membro ativo da organização; escrita só pelos triggers.
create policy activity_logs_select_member on public.activity_logs for select to authenticated
  using (private.is_active_member(organization_id));

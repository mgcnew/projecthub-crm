-- Fase 4: recurrence_rules, calendar_events, meetings; tasks.meeting_id.
-- Work blocks são calendar_events com event_type = 'work_block' ligados a uma tarefa (D004).
-- Recorrência mínima (D040): sem exceções por ocorrência; edição vale para a série inteira.
-- Ocorrências são expandidas sob demanda no fuso do evento (identidade: event_id + occurrence_start).

-- ------------------------------------------------------- recurrence_rules
create table public.recurrence_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  frequency text not null check (frequency in ('daily', 'weekly', 'monthly')),
  interval_value integer not null default 1 check (interval_value between 1 and 365),
  -- 0 = domingo ... 6 = sábado. Vazio = dia da semana do início (semanal).
  by_weekday smallint[] not null default '{}'
    check (by_weekday <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  -- starts_on e timezone são derivados do evento por trigger (âncora da série).
  starts_on date not null,
  ends_on date,
  occurrence_limit integer check (occurrence_limit is null or occurrence_limit between 1 and 3660),
  timezone text not null,
  -- Inativa: o evento aparece só na primeira ocorrência.
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  check (ends_on is null or ends_on >= starts_on),
  check (frequency = 'weekly' or cardinality(by_weekday) = 0)
);

-- ---------------------------------------------------------- calendar_events
create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  task_id uuid,
  project_id uuid,
  client_id uuid,
  title text not null check (char_length(btrim(title)) between 1 and 300),
  description text check (description is null or char_length(description) <= 20000),
  event_type text not null default 'event' check (event_type in ('event', 'meeting', 'work_block')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled')),
  recurrence_rule_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  check (ends_at > starts_at),
  check (event_type <> 'work_block' or task_id is not null),
  check (event_type <> 'work_block' or recurrence_rule_id is null),
  foreign key (organization_id, task_id) references public.tasks (organization_id, id),
  foreign key (organization_id, project_id) references public.projects (organization_id, id),
  foreign key (organization_id, client_id) references public.clients (organization_id, id),
  foreign key (organization_id, recurrence_rule_id) references public.recurrence_rules (organization_id, id)
);

create unique index calendar_events_rule_unique on public.calendar_events (recurrence_rule_id)
  where recurrence_rule_id is not null;
create index calendar_events_org_start_idx on public.calendar_events (organization_id, starts_at)
  where status <> 'cancelled';
create index calendar_events_org_task_idx on public.calendar_events (organization_id, task_id)
  where task_id is not null;
create index calendar_events_org_project_idx on public.calendar_events (organization_id, project_id)
  where project_id is not null;
create index calendar_events_org_client_idx on public.calendar_events (organization_id, client_id)
  where client_id is not null;

-- ----------------------------------------------------------------- meetings
create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  calendar_event_id uuid not null,
  agenda text check (agenda is null or char_length(agenda) <= 20000),
  notes text check (notes is null or char_length(notes) <= 50000),
  decisions text check (decisions is null or char_length(decisions) <= 20000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (calendar_event_id),
  foreign key (organization_id, calendar_event_id)
    references public.calendar_events (organization_id, id) on delete cascade
);

-- Tarefas geradas numa reunião.
alter table public.tasks add column meeting_id uuid;
alter table public.tasks
  add foreign key (organization_id, meeting_id) references public.meetings (organization_id, id);
create index tasks_org_meeting_idx on public.tasks (organization_id, meeting_id) where meeting_id is not null;

-- ------------------------------------------------------------------ triggers
create function private.is_valid_timezone(p_tz text)
returns boolean
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_tz is null or btrim(p_tz) = '' then
    return false;
  end if;
  perform now() at time zone p_tz;
  return true;
exception when others then
  return false;
end;
$$;

-- Evento: valida fuso e sincroniza a âncora da série (starts_on/timezone).
create function private.calendar_events_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_start_date date;
  v_rule public.recurrence_rules;
begin
  if not private.is_valid_timezone(new.timezone) then
    raise exception 'invalid timezone: %', new.timezone using errcode = '23514';
  end if;

  if new.recurrence_rule_id is not null then
    v_start_date := (new.starts_at at time zone new.timezone)::date;

    select r.* into v_rule
      from public.recurrence_rules r
     where r.id = new.recurrence_rule_id and r.organization_id = new.organization_id;

    if found then
      if v_rule.frequency = 'weekly' and cardinality(v_rule.by_weekday) > 0
         and not (extract(dow from v_start_date)::smallint = any (v_rule.by_weekday)) then
        raise exception 'weekly recurrence must include the weekday of the first occurrence'
          using errcode = '23514';
      end if;
      if v_rule.ends_on is not null and v_rule.ends_on < v_start_date then
        raise exception 'recurrence ends before it starts' using errcode = '23514';
      end if;
      update public.recurrence_rules
         set starts_on = v_start_date, timezone = new.timezone
       where id = v_rule.id
         and (starts_on is distinct from v_start_date or timezone is distinct from new.timezone);
    end if;
  end if;

  return new;
end;
$$;

create trigger calendar_events_before_write
  before insert or update on public.calendar_events
  for each row execute function private.calendar_events_before_write();

create trigger calendar_events_set_updated_at before update on public.calendar_events
  for each row execute function private.set_updated_at();

-- Evento de reunião cria sua linha em meetings (atômico, sem RPC).
create function private.calendar_events_create_meeting()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.event_type = 'meeting' then
    insert into public.meetings (organization_id, calendar_event_id)
    values (new.organization_id, new.id)
    on conflict (calendar_event_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger calendar_events_create_meeting
  after insert on public.calendar_events
  for each row execute function private.calendar_events_create_meeting();

create trigger meetings_set_updated_at before update on public.meetings
  for each row execute function private.set_updated_at();

-- Regra: a lista de dias precisa continuar contendo o dia do primeiro evento.
create function private.recurrence_rules_validate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_start date;
begin
  if new.frequency = 'weekly' and cardinality(new.by_weekday) > 0 then
    select (e.starts_at at time zone e.timezone)::date into v_start
      from public.calendar_events e
     where e.recurrence_rule_id = new.id and e.organization_id = new.organization_id;
    if found and not (extract(dow from v_start)::smallint = any (new.by_weekday)) then
      raise exception 'weekly recurrence must include the weekday of the first occurrence'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger recurrence_rules_validate
  before update on public.recurrence_rules
  for each row execute function private.recurrence_rules_validate();

-- ------------------------------------------------------------- ocorrências
-- Expande eventos (inclusive recorrentes) numa janela. SECURITY INVOKER: respeita a RLS do chamador.
create function public.list_calendar_occurrences(p_from timestamptz, p_to timestamptz)
returns table (
  event_id uuid,
  occurrence_start timestamptz,
  occurrence_end timestamptz,
  occurrence_date date,
  is_recurring boolean,
  title text,
  event_type text,
  status text,
  timezone text,
  task_id uuid,
  project_id uuid,
  client_id uuid
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if p_from is null or p_to is null or p_to <= p_from then
    raise exception 'invalid window' using errcode = '22023';
  end if;
  if p_to - p_from > interval '93 days' then
    raise exception 'window too large (max 93 days)' using errcode = '22023';
  end if;

  return query
  -- Eventos simples (ou séries inativas): só o evento-base.
  select e.id, e.starts_at, e.ends_at, (e.starts_at at time zone e.timezone)::date, false,
         e.title, e.event_type, e.status, e.timezone, e.task_id, e.project_id, e.client_id
    from public.calendar_events e
    left join public.recurrence_rules r
      on r.id = e.recurrence_rule_id and r.organization_id = e.organization_id
   where e.status <> 'cancelled'
     and (r.id is null or not r.is_active)
     and e.starts_at < p_to and e.ends_at > p_from

  union all

  -- Séries ativas: ocorrências no fuso do evento (o horário local se mantém no horário de verão).
  select s.id,
         s.occ_start,
         s.occ_start + s.dur,
         s.d,
         true,
         s.title, s.event_type, s.status, s.timezone, s.task_id, s.project_id, s.client_id
    from (
      select x.*,
             ((x.d + x.start_time)::timestamp at time zone x.timezone) as occ_start,
             row_number() over (partition by x.id order by x.d) as idx
        from (
          select e.id, e.title, e.event_type, e.status, e.timezone, e.task_id, e.project_id, e.client_id,
                 (e.ends_at - e.starts_at) as dur,
                 (e.starts_at at time zone e.timezone)::date as start_date,
                 (e.starts_at at time zone e.timezone)::time as start_time,
                 r.frequency, r.interval_value, r.by_weekday, r.occurrence_limit,
                 d::date as d
            from public.calendar_events e
            join public.recurrence_rules r
              on r.id = e.recurrence_rule_id and r.organization_id = e.organization_id and r.is_active
            cross join lateral generate_series(
              case
                when r.occurrence_limit is null
                  then greatest((e.starts_at at time zone e.timezone)::date,
                                (p_from at time zone e.timezone)::date - 1)
                else (e.starts_at at time zone e.timezone)::date
              end,
              least(
                coalesce(r.ends_on, 'infinity'::date),
                (p_to at time zone e.timezone)::date,
                (e.starts_at at time zone e.timezone)::date + 3660
              ),
              interval '1 day'
            ) as d
           where e.status <> 'cancelled'
        ) x
       where case x.frequency
         when 'daily' then (x.d - x.start_date) % x.interval_value = 0
         when 'weekly' then
           extract(dow from x.d)::smallint = any (
             case when cardinality(x.by_weekday) > 0 then x.by_weekday
                  else array[extract(dow from x.start_date)::smallint] end)
           and ((x.d - date_trunc('week', x.start_date::timestamp)::date) / 7) % x.interval_value = 0
         when 'monthly' then
           extract(day from x.d) = extract(day from x.start_date)
           and ((extract(year from x.d) * 12 + extract(month from x.d))
                - (extract(year from x.start_date) * 12 + extract(month from x.start_date)))::int
               % x.interval_value = 0
         else false
       end
    ) s
   where (s.occurrence_limit is null or s.idx <= s.occurrence_limit)
     and s.occ_start < p_to and s.occ_start + s.dur > p_from

  order by 2, 1;
end;
$$;

revoke all on function public.list_calendar_occurrences(timestamptz, timestamptz) from public, anon;
grant execute on function public.list_calendar_occurrences(timestamptz, timestamptz) to authenticated;

revoke all on function private.is_valid_timezone(text) from public, anon, authenticated;
revoke all on function private.calendar_events_before_write() from public, anon, authenticated;
revoke all on function private.calendar_events_create_meeting() from public, anon, authenticated;
revoke all on function private.recurrence_rules_validate() from public, anon, authenticated;

-- ------------------------------------------------------------------ grants
revoke all on public.recurrence_rules, public.calendar_events, public.meetings
  from public, anon, authenticated;
grant select on public.recurrence_rules, public.calendar_events, public.meetings to authenticated;

grant insert (organization_id, frequency, interval_value, by_weekday, starts_on, ends_on,
              occurrence_limit, timezone, is_active)
  on public.recurrence_rules to authenticated;
-- starts_on e timezone seguem o evento (trigger).
grant update (frequency, interval_value, by_weekday, ends_on, occurrence_limit, is_active)
  on public.recurrence_rules to authenticated;

-- event_type é imutável depois da criação.
grant insert (organization_id, task_id, project_id, client_id, title, description, event_type,
              starts_at, ends_at, timezone, status, recurrence_rule_id)
  on public.calendar_events to authenticated;
grant update (task_id, project_id, client_id, title, description, starts_at, ends_at, timezone,
              status, recurrence_rule_id)
  on public.calendar_events to authenticated;

-- meetings: criada por trigger; o cliente só edita o conteúdo.
grant update (agenda, notes, decisions) on public.meetings to authenticated;

grant insert (meeting_id) on public.tasks to authenticated;
grant update (meeting_id) on public.tasks to authenticated;

-- --------------------------------------------------------------------- RLS
alter table public.recurrence_rules enable row level security;
alter table public.calendar_events enable row level security;
alter table public.meetings enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['recurrence_rules', 'calendar_events', 'meetings']
  loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (private.is_active_member(organization_id))',
      t || '_select_member', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (private.is_active_owner(organization_id)) with check (private.is_active_owner(organization_id))',
      t || '_update_owner', t);
  end loop;

  -- meetings não tem INSERT para o cliente (trigger).
  foreach t in array array['recurrence_rules', 'calendar_events']
  loop
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (private.is_active_owner(organization_id))',
      t || '_insert_owner', t);
  end loop;
end $$;

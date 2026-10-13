-- Fase 5: lembretes, notificações internas e worker confiável.
-- Lembrete de tarefa = instante absoluto (remind_at). Lembrete de evento = antecedência em minutos
-- (offset_minutes) aplicada a cada ocorrência, inclusive de séries recorrentes (D047).
-- O disparo é idempotente: no máximo uma notificação por (lembrete, ocorrência), garantido por índice único.
-- Canal único do MVP: in_app (push/WhatsApp ficam fora, D011).

create extension if not exists pg_cron with schema pg_catalog;

-- ---------------------------------------------------------------- reminders
create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  -- Destinatário. Sempre o autor do lembrete (default + política); imutável para o cliente.
  user_id uuid not null default auth.uid(),
  task_id uuid,
  event_id uuid,
  remind_at timestamptz,
  offset_minutes integer check (offset_minutes between 0 and 10080),
  status text not null default 'active' check (status in ('active', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  check (num_nonnulls(task_id, event_id) = 1),
  check (
    (task_id is not null and remind_at is not null and offset_minutes is null)
    or (event_id is not null and offset_minutes is not null and remind_at is null)
  ),
  foreign key (organization_id, user_id)
    references public.organization_members (organization_id, user_id) on delete cascade,
  foreign key (organization_id, task_id)
    references public.tasks (organization_id, id) on delete cascade,
  foreign key (organization_id, event_id)
    references public.calendar_events (organization_id, id) on delete cascade
);

-- Sem lembretes duplicados idênticos (evita disparo em dobro).
create unique index reminders_task_unique on public.reminders (user_id, task_id, remind_at)
  where task_id is not null and status = 'active';
create unique index reminders_event_unique on public.reminders (user_id, event_id, offset_minutes)
  where event_id is not null and status = 'active';
create index reminders_org_task_idx on public.reminders (organization_id, task_id) where task_id is not null;
create index reminders_org_event_idx on public.reminders (organization_id, event_id) where event_id is not null;
create index reminders_due_idx on public.reminders (remind_at)
  where status = 'active' and task_id is not null;

-- remind_at não pode ser definido (ou movido) para o passado; tolerância de 1 minuto.
create function private.reminders_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.remind_at is not null
     and (tg_op = 'INSERT' or new.remind_at is distinct from old.remind_at)
     and new.remind_at < now() - interval '1 minute' then
    raise exception 'reminder time is in the past' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger reminders_before_write
  before insert or update on public.reminders
  for each row execute function private.reminders_before_write();

create trigger reminders_set_updated_at before update on public.reminders
  for each row execute function private.set_updated_at();

-- ------------------------------------------------------------ notifications
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null,
  reminder_id uuid,
  task_id uuid,
  event_id uuid,
  -- Chave do disparo: remind_at (tarefa) ou início da ocorrência (evento).
  occurrence_at timestamptz not null,
  title text not null check (char_length(btrim(title)) between 1 and 300),
  body text check (body is null or char_length(body) <= 1000),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, user_id)
    references public.organization_members (organization_id, user_id) on delete cascade,
  foreign key (organization_id, reminder_id)
    references public.reminders (organization_id, id) on delete set null (reminder_id),
  foreign key (organization_id, task_id)
    references public.tasks (organization_id, id) on delete set null (task_id),
  foreign key (organization_id, event_id)
    references public.calendar_events (organization_id, id) on delete set null (event_id)
);

-- Idempotência do worker: um disparo por lembrete e ocorrência.
create unique index notifications_dedupe on public.notifications (reminder_id, occurrence_at)
  where reminder_id is not null;
create index notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index notifications_user_unread_idx on public.notifications (user_id) where read_at is null;

-- ---------------------------------------------------- notification_deliveries
create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  notification_id uuid not null,
  channel text not null check (channel in ('in_app')),
  status text not null check (status in ('pending', 'delivered', 'failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (notification_id, channel),
  foreign key (organization_id, notification_id)
    references public.notifications (organization_id, id) on delete cascade
);

-- ------------------------------------------------------------------- worker
-- Gera as notificações vencidas. Chamado pelo pg_cron a cada minuto; p_now existe para testes.
-- Janela de recuperação de 24 h: atrasos do scheduler ainda disparam, lembretes antigos não.
-- Roda como dono das tabelas (sem RLS); só considera membros ativos, tarefas abertas e eventos agendados.
create function private.process_due_reminders(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tasks integer := 0;
  v_events integer := 0;
begin
  -- Tarefas: instante absoluto.
  with ins as (
    insert into public.notifications
      (organization_id, user_id, reminder_id, task_id, occurrence_at, title, body)
    select r.organization_id, r.user_id, r.id, r.task_id, r.remind_at, t.title, 'Lembrete de tarefa'
      from public.reminders r
      join public.tasks t
        on t.organization_id = r.organization_id and t.id = r.task_id
      join public.organization_members m
        on m.organization_id = r.organization_id and m.user_id = r.user_id and m.status = 'active'
     where r.status = 'active'
       and r.task_id is not null
       and t.status in ('todo', 'in_progress')
       and r.remind_at <= p_now
       and r.remind_at > p_now - interval '24 hours'
    on conflict (reminder_id, occurrence_at) where reminder_id is not null do nothing
    returning id, organization_id
  ),
  dl as (
    insert into public.notification_deliveries
      (organization_id, notification_id, channel, status, attempt_count, sent_at)
    select organization_id, id, 'in_app', 'delivered', 1, p_now from ins
    returning 1
  )
  select count(*) into v_tasks from dl;

  -- Eventos: antecedência aplicada a cada ocorrência (D041: identidade event_id + occurrence_start).
  -- Antecedência máxima = 7 dias, logo o início da ocorrência fica em [now - 24 h, now + 7 d].
  if exists (
    select 1 from public.reminders where status = 'active' and event_id is not null
  ) then
    with occ as (
      select o.*
        from public.list_calendar_occurrences(
          p_now - interval '24 hours', p_now + interval '7 days' + interval '1 second') o
       where o.status = 'scheduled'
    ),
    ins as (
      insert into public.notifications
        (organization_id, user_id, reminder_id, event_id, occurrence_at, title, body)
      select r.organization_id, r.user_id, r.id, r.event_id, o.occurrence_start, e.title,
             'Começa em ' || to_char(o.occurrence_start at time zone o.timezone, 'DD/MM/YYYY "às" HH24:MI')
               || ' (' || o.timezone || ')'
        from public.reminders r
        join occ o on o.event_id = r.event_id
        join public.calendar_events e
          on e.id = r.event_id and e.organization_id = r.organization_id
        join public.organization_members m
          on m.organization_id = r.organization_id and m.user_id = r.user_id and m.status = 'active'
       where r.status = 'active'
         and r.event_id is not null
         and o.occurrence_start - make_interval(mins => r.offset_minutes) <= p_now
         and o.occurrence_start - make_interval(mins => r.offset_minutes) > p_now - interval '24 hours'
         and o.occurrence_end > p_now
      on conflict (reminder_id, occurrence_at) where reminder_id is not null do nothing
      returning id, organization_id
    ),
    dl as (
      insert into public.notification_deliveries
        (organization_id, notification_id, channel, status, attempt_count, sent_at)
      select organization_id, id, 'in_app', 'delivered', 1, p_now from ins
      returning 1
    )
    select count(*) into v_events from dl;
  end if;

  return v_tasks + v_events;
end;
$$;

revoke all on function private.reminders_before_write() from public, anon, authenticated;
revoke all on function private.process_due_reminders(timestamptz) from public, anon, authenticated;

select cron.schedule(
  'process-due-reminders',
  '* * * * *',
  $$select private.process_due_reminders()$$
);

-- ------------------------------------------------------------------ grants
revoke all on public.reminders, public.notifications, public.notification_deliveries
  from public, anon, authenticated;

-- reminders: o dono escreve; user_id vem do default (auth.uid()) e é imutável.
grant select, delete on public.reminders to authenticated;
grant insert (organization_id, task_id, event_id, remind_at, offset_minutes, status)
  on public.reminders to authenticated;
grant update (remind_at, offset_minutes, status) on public.reminders to authenticated;

-- notifications: só leitura e marcar como lida; criação é exclusiva do worker.
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

-- notification_deliveries: sem acesso pela API (telemetria interna do worker).

-- --------------------------------------------------------------------- RLS
alter table public.reminders enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_deliveries enable row level security;

create policy reminders_select_own on public.reminders for select to authenticated
  using (user_id = (select auth.uid()) and private.is_active_member(organization_id));
create policy reminders_insert_own on public.reminders for insert to authenticated
  with check (user_id = (select auth.uid()) and private.is_active_owner(organization_id));
create policy reminders_update_own on public.reminders for update to authenticated
  using (user_id = (select auth.uid()) and private.is_active_owner(organization_id))
  with check (user_id = (select auth.uid()) and private.is_active_owner(organization_id));
create policy reminders_delete_own on public.reminders for delete to authenticated
  using (user_id = (select auth.uid()) and private.is_active_owner(organization_id));

create policy notifications_select_own on public.notifications for select to authenticated
  using (user_id = (select auth.uid()) and private.is_active_member(organization_id));
create policy notifications_update_own on public.notifications for update to authenticated
  using (user_id = (select auth.uid()) and private.is_active_member(organization_id))
  with check (user_id = (select auth.uid()) and private.is_active_member(organization_id));

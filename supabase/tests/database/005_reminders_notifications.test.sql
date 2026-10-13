-- Fase 5: lembretes, notificações internas e worker (idempotência, fusos, isolamento).
begin;
create extension if not exists pgtap with schema extensions;
select plan(49);

create function public.t_rowcount(p_sql text) returns int language plpgsql as $$
declare n int; begin execute p_sql; get diagnostics n = row_count; return n; end $$;
create function public.t_act_as(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

insert into auth.users (id, email, aud, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@test.local', 'authenticated', 'authenticated'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@test.local', 'authenticated', 'authenticated'),
  ('cccccccc-0000-0000-0000-000000000003', 'c@test.local', 'authenticated', 'authenticated');

create temp table ctx as
select (select id from public.organizations where created_by = 'aaaaaaaa-0000-0000-0000-000000000001') as org_a,
       (select id from public.organizations where created_by = 'bbbbbbbb-0000-0000-0000-000000000002') as org_b;
grant select on ctx to authenticated;

-- T: instante futuro (relativo ao now() da transação) usado nos lembretes de tarefa.
create temp table tt as select date_trunc('hour', now()) + interval '2 hours' as t;
grant select on tt to authenticated;

insert into public.organization_members (organization_id, user_id, role)
  select org_a, 'cccccccc-0000-0000-0000-000000000003', 'member' from ctx;
insert into public.tasks (id, organization_id, title) select 'aaaaaaaa-3333-0000-0000-000000000001', org_a, 'Tarefa A' from ctx;
insert into public.tasks (id, organization_id, title, status)
  select 'aaaaaaaa-3333-0000-0000-000000000002', org_a, 'Tarefa Feita', 'done' from ctx;
insert into public.tasks (id, organization_id, title) select 'bbbbbbbb-3333-0000-0000-000000000001', org_b, 'Tarefa B' from ctx;

-- ============================================================ A (owner)
select public.t_act_as('aaaaaaaa-0000-0000-0000-000000000001');

select lives_ok($$insert into public.reminders (organization_id, task_id, remind_at)
  select org_a, 'aaaaaaaa-3333-0000-0000-000000000001', (select t from tt) from ctx$$,
  'cria lembrete de tarefa');
select is((select user_id from public.reminders), 'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
  'destinatário é o autor (auth.uid)');
select throws_ok($$insert into public.reminders (organization_id, task_id, remind_at)
  select org_a, 'aaaaaaaa-3333-0000-0000-000000000001', (select t from tt) from ctx$$,
  '23505', null, 'lembrete idêntico duplicado é rejeitado');
select throws_ok($$insert into public.reminders (organization_id, task_id, remind_at)
  select org_a, 'aaaaaaaa-3333-0000-0000-000000000001', now() - interval '1 day' from ctx$$,
  '23514', null, 'lembrete no passado é rejeitado');
select throws_ok($$insert into public.reminders (organization_id, remind_at)
  select org_a, (select t from tt) from ctx$$,
  '23514', null, 'lembrete sem tarefa nem evento');
select throws_ok($$insert into public.reminders (organization_id, task_id, remind_at, offset_minutes)
  select org_a, 'aaaaaaaa-3333-0000-0000-000000000001', (select t from tt) + interval '1 hour', 15 from ctx$$,
  '23514', null, 'lembrete de tarefa não aceita antecedência');
select throws_ok($$insert into public.reminders (organization_id, task_id, remind_at)
  select org_a, 'bbbbbbbb-3333-0000-0000-000000000001', (select t from tt) from ctx$$,
  '23503', null, 'tarefa de outra organização');
select throws_ok($$insert into public.reminders (organization_id, task_id, remind_at)
  select org_b, 'bbbbbbbb-3333-0000-0000-000000000001', (select t from tt) from ctx$$,
  '42501', null, 'A não cria lembrete na organização B');
select throws_ok($$insert into public.reminders (organization_id, user_id, task_id, remind_at)
  select org_a, 'cccccccc-0000-0000-0000-000000000003', 'aaaaaaaa-3333-0000-0000-000000000001',
         (select t from tt) + interval '2 hours' from ctx$$,
  '42501', null, 'cliente não define o destinatário');

select lives_ok($$insert into public.reminders (organization_id, task_id, remind_at)
  select org_a, 'aaaaaaaa-3333-0000-0000-000000000002', (select t from tt) from ctx$$,
  'lembrete em tarefa concluída é aceito (não dispara)');

-- Série diária em Nova York, atravessando o fim do horário de verão (03/11/2030).
select lives_ok($$insert into public.recurrence_rules (organization_id, frequency, starts_on, timezone)
  select org_a, 'daily', '2030-11-02', 'America/New_York' from ctx$$, 'regra diária');
select lives_ok($$insert into public.calendar_events (organization_id, title, starts_at, ends_at, timezone, recurrence_rule_id)
  select org_a, 'Daily NY', '2030-11-02T13:00:00Z', '2030-11-02T14:00:00Z', 'America/New_York',
         (select r.id from public.recurrence_rules r where r.starts_on = '2030-11-02') from ctx$$,
  'evento 09:00 NY (EDT)');
select lives_ok($$insert into public.reminders (organization_id, event_id, offset_minutes)
  select org_a, (select id from public.calendar_events where title = 'Daily NY'), 30 from ctx$$,
  'lembrete de evento 30 min antes');
select throws_ok($$insert into public.reminders (organization_id, event_id, offset_minutes)
  select org_a, (select id from public.calendar_events where title = 'Daily NY'), 10081 from ctx$$,
  '23514', null, 'antecedência acima de 7 dias');
select throws_ok($$insert into public.reminders (organization_id, event_id, offset_minutes)
  select org_a, (select id from public.calendar_events where title = 'Daily NY'), 30 from ctx$$,
  '23505', null, 'antecedência duplicada no mesmo evento');
reset role;

-- ============================================================ worker (idempotência)
select is(private.process_due_reminders((select t from tt) - interval '1 minute'), 0,
  'nada dispara antes da hora');
select is(private.process_due_reminders((select t from tt)), 1,
  'dispara o lembrete vencido (tarefa concluída é ignorada)');
select is(private.process_due_reminders((select t from tt)), 0, 'segunda execução não duplica');
select is(private.process_due_reminders((select t from tt) + interval '1 minute'), 0,
  'execuções seguintes não duplicam');
select is((select count(*)::int from public.notifications where task_id = 'aaaaaaaa-3333-0000-0000-000000000001'), 1,
  'uma única notificação por lembrete/ocorrência');
select is((select d.status || ':' || d.channel from public.notification_deliveries d
             join public.notifications n on n.id = d.notification_id
            where n.task_id = 'aaaaaaaa-3333-0000-0000-000000000001'),
  'delivered:in_app', 'entrega in_app registrada');

-- Fora da janela de recuperação de 24 h não dispara.
insert into public.reminders (organization_id, user_id, task_id, remind_at)
  select org_a, 'aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-3333-0000-0000-000000000001',
         (select t from tt) + interval '3 hours' from ctx;
select is(private.process_due_reminders((select t from tt) + interval '3 hours' + interval '25 hours'), 0,
  'lembrete antigo (> 24 h) não dispara');

-- Eventos recorrentes, fuso e horário de verão.
select is(private.process_due_reminders('2030-11-02T12:29:00Z'), 0, 'antes da antecedência não dispara');
select is(private.process_due_reminders('2030-11-02T12:30:00Z'), 1, 'dispara 30 min antes da 1ª ocorrência');
select is(private.process_due_reminders('2030-11-02T12:30:00Z'), 0, 'reexecução não duplica (evento)');
select is(private.process_due_reminders('2030-11-03T13:29:00Z'), 0,
  'após o fim do horário de verão a ocorrência é 14:00Z; 13:29Z ainda não dispara');
select is(private.process_due_reminders('2030-11-03T13:30:00Z'), 1, 'dispara às 13:30Z (09:00 EST - 30 min)');
select is((select array_agg(occurrence_at order by occurrence_at) from public.notifications
            where reminder_id = (select id from public.reminders where offset_minutes = 30)),
  array['2030-11-02T13:00:00Z', '2030-11-03T14:00:00Z']::timestamptz[],
  'uma notificação por ocorrência, com o horário real de cada uma');

-- Cancelar o evento interrompe os disparos.
update public.calendar_events set status = 'cancelled' where title = 'Daily NY';
select is(private.process_due_reminders('2030-11-04T13:30:00Z'), 0, 'evento cancelado não dispara');

-- ============================================================ A (cliente): notificações
select public.t_act_as('aaaaaaaa-0000-0000-0000-000000000001');
select is((select count(*)::int from public.notifications), 3, 'A vê as próprias notificações');
select is(public.t_rowcount($$update public.notifications set read_at = now() where read_at is null$$), 3,
  'A marca como lidas');
select throws_ok($$update public.notifications set title = 'adulterado'$$, '42501', null,
  'A só altera read_at');
select throws_ok($$insert into public.notifications (organization_id, user_id, occurrence_at, title)
  select org_a, 'aaaaaaaa-0000-0000-0000-000000000001', now(), 'forjada' from ctx$$,
  '42501', null, 'cliente não cria notificações');
select throws_ok($$delete from public.notifications$$, '42501', null, 'cliente não apaga notificações');
select throws_ok($$select * from public.notification_deliveries$$, '42501', null,
  'cliente não lê entregas');
select is(public.t_rowcount($$delete from public.reminders where task_id = 'aaaaaaaa-3333-0000-0000-000000000001'$$), 2,
  'A remove lembretes da tarefa');
select is((select count(*)::int from public.notifications), 3, 'notificações permanecem sem o lembrete');
reset role;

-- ============================================================ C (member)
select public.t_act_as('cccccccc-0000-0000-0000-000000000003');
select is((select count(*)::int from public.notifications), 0, 'member não vê notificações de A');
select is((select count(*)::int from public.reminders), 0, 'member não vê lembretes de A');
select throws_ok($$insert into public.reminders (organization_id, task_id, remind_at)
  select org_a, 'aaaaaaaa-3333-0000-0000-000000000001', (select t from tt) + interval '5 hours' from ctx$$,
  '42501', null, 'member não cria lembrete');
reset role;

-- Membro suspenso não recebe notificações.
insert into public.reminders (organization_id, user_id, task_id, remind_at)
  select org_a, 'cccccccc-0000-0000-0000-000000000003', 'aaaaaaaa-3333-0000-0000-000000000001',
         (select t from tt) + interval '6 hours' from ctx;
update public.organization_members set status = 'suspended'
 where user_id = 'cccccccc-0000-0000-0000-000000000003'
   and organization_id = (select org_a from ctx);
select is(private.process_due_reminders((select t from tt) + interval '6 hours'), 0,
  'membro suspenso não recebe notificação');
select is((select count(*)::int from public.notifications where user_id = 'cccccccc-0000-0000-0000-000000000003'), 0,
  'nenhuma notificação criada para o suspenso');

-- ============================================================ B isolado / anon
select public.t_act_as('bbbbbbbb-0000-0000-0000-000000000002');
select is((select count(*)::int from public.notifications), 0, 'B não lê notificações de A');
select is((select count(*)::int from public.reminders), 0, 'B não lê lembretes de A');
select is(public.t_rowcount($$update public.notifications set read_at = null$$), 0,
  'B não altera notificações de A');
select throws_ok($$insert into public.reminders (organization_id, task_id, remind_at)
  select org_b, 'aaaaaaaa-3333-0000-0000-000000000001', (select t from tt) + interval '7 hours' from ctx$$,
  '23503', null, 'B não referencia tarefa de A');
reset role;

select ok(not has_table_privilege('anon', 'public.notifications', 'SELECT'), 'anon sem acesso a notificações');
select ok(not has_function_privilege('authenticated', 'private.process_due_reminders(timestamptz)', 'EXECUTE'),
  'authenticated não executa o worker');
select is((select count(*)::int from cron.job where jobname = 'process-due-reminders' and schedule = '* * * * *'), 1,
  'worker agendado a cada minuto no pg_cron');

select * from finish();
rollback;

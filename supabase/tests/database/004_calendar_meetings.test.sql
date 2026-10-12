-- Fase 4: agenda, work blocks, reuniões, recorrência mínima e fusos.
begin;
create extension if not exists pgtap with schema extensions;
select plan(43);

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

insert into public.clients (id, organization_id, name) select 'bbbbbbbb-1111-0000-0000-000000000001', org_b, 'Cliente B' from ctx;
insert into public.projects (id, organization_id, name) select 'bbbbbbbb-2222-0000-0000-000000000001', org_b, 'Projeto B' from ctx;
insert into public.tasks (id, organization_id, title) select 'bbbbbbbb-3333-0000-0000-000000000001', org_b, 'Tarefa B' from ctx;
insert into public.organization_members (organization_id, user_id, role)
  select org_a, 'cccccccc-0000-0000-0000-000000000003', 'member' from ctx;
insert into public.tasks (id, organization_id, title) select 'aaaaaaaa-3333-0000-0000-000000000001', org_a, 'Tarefa A' from ctx;

-- ============================================================ A (owner)
select public.t_act_as('aaaaaaaa-0000-0000-0000-000000000001');

-- eventos simples
select lives_ok($$insert into public.calendar_events (organization_id, title, starts_at, ends_at, timezone)
  select org_a, 'Dentista', '2026-11-03T13:00:00Z', '2026-11-03T14:00:00Z', 'America/Sao_Paulo' from ctx$$,
  'cria evento simples');
select throws_ok($$insert into public.calendar_events (organization_id, title, starts_at, ends_at, timezone)
  select org_a, 'x', '2026-11-03T14:00:00Z', '2026-11-03T14:00:00Z', 'UTC' from ctx$$,
  '23514', null, 'fim deve ser posterior ao início');
select throws_ok($$insert into public.calendar_events (organization_id, title, starts_at, ends_at, timezone)
  select org_a, 'x', '2026-11-03T13:00:00Z', '2026-11-03T14:00:00Z', 'Mars/Olympus' from ctx$$,
  '23514', null, 'fuso inválido é rejeitado');
select throws_ok($$insert into public.calendar_events (organization_id, title, starts_at, ends_at, timezone, event_type)
  select org_a, 'x', '2026-11-03T13:00:00Z', '2026-11-03T14:00:00Z', 'UTC', 'qualquer' from ctx$$,
  '23514', null, 'tipo de evento inválido');

-- vínculos entre tenants
select throws_ok($$insert into public.calendar_events (organization_id, title, starts_at, ends_at, timezone, project_id)
  select org_a, 'x', '2026-11-03T13:00:00Z', '2026-11-03T14:00:00Z', 'UTC', 'bbbbbbbb-2222-0000-0000-000000000001' from ctx$$,
  '23503', null, 'projeto de outra organização');
select throws_ok($$insert into public.calendar_events (organization_id, title, starts_at, ends_at, timezone, client_id)
  select org_a, 'x', '2026-11-03T13:00:00Z', '2026-11-03T14:00:00Z', 'UTC', 'bbbbbbbb-1111-0000-0000-000000000001' from ctx$$,
  '23503', null, 'cliente de outra organização');
select throws_ok($$insert into public.calendar_events (organization_id, title, starts_at, ends_at, timezone, task_id, event_type)
  select org_a, 'x', '2026-11-03T13:00:00Z', '2026-11-03T14:00:00Z', 'UTC', 'bbbbbbbb-3333-0000-0000-000000000001', 'work_block' from ctx$$,
  '23503', null, 'tarefa de outra organização');
select throws_ok($$insert into public.calendar_events (organization_id, title, starts_at, ends_at, timezone)
  select org_b, 'invasor', '2026-11-03T13:00:00Z', '2026-11-03T14:00:00Z', 'UTC' from ctx$$,
  '42501', null, 'A não cria evento na organização B');

-- work blocks
select throws_ok($$insert into public.calendar_events (organization_id, title, starts_at, ends_at, timezone, event_type)
  select org_a, 'Bloco', '2026-11-03T13:00:00Z', '2026-11-03T14:00:00Z', 'UTC', 'work_block' from ctx$$,
  '23514', null, 'work_block exige tarefa');
select lives_ok($$insert into public.calendar_events (organization_id, title, starts_at, ends_at, timezone, event_type, task_id)
  select org_a, 'Bloco 1', '2026-11-04T12:00:00Z', '2026-11-04T13:00:00Z', 'UTC', 'work_block', 'aaaaaaaa-3333-0000-0000-000000000001' from ctx$$,
  'cria work block');
select lives_ok($$insert into public.calendar_events (organization_id, title, starts_at, ends_at, timezone, event_type, task_id)
  select org_a, 'Bloco 2', '2026-11-05T12:00:00Z', '2026-11-05T13:00:00Z', 'UTC', 'work_block', 'aaaaaaaa-3333-0000-0000-000000000001' from ctx$$,
  'múltiplos blocos para a mesma tarefa');
select is((select count(*)::int from public.calendar_events where task_id = 'aaaaaaaa-3333-0000-0000-000000000001'), 2,
  'tarefa com 2 blocos');
select is((select due_date from public.tasks where id = 'aaaaaaaa-3333-0000-0000-000000000001'), null::date,
  'reservar bloco não altera o prazo');
select throws_ok($$update public.calendar_events set event_type = 'meeting' where title = 'Dentista'$$,
  '42501', null, 'event_type é imutável');
select throws_ok($$delete from public.calendar_events$$, '42501', null, 'cliente não apaga eventos');

-- reuniões
select lives_ok($$insert into public.calendar_events (organization_id, title, starts_at, ends_at, timezone, event_type)
  select org_a, 'Reunião de kickoff', '2026-11-06T15:00:00Z', '2026-11-06T16:00:00Z', 'UTC', 'meeting' from ctx$$,
  'cria evento de reunião');
select is((select count(*)::int from public.meetings), 1, 'reunião criada automaticamente');
select throws_ok($$insert into public.meetings (organization_id, calendar_event_id)
  select org_a, e.id from ctx, public.calendar_events e where e.title = 'Dentista'$$, '42501', null,
  'cliente não insere reunião diretamente');
select lives_ok($$update public.meetings set agenda = 'Pauta', notes = 'Notas', decisions = 'Decidido'$$,
  'edita pauta, notas e decisões');
select lives_ok($$insert into public.tasks (organization_id, title, meeting_id)
  select org_a, 'Ação da reunião', m.id from ctx, public.meetings m$$, 'tarefa gerada na reunião');
select throws_ok($$insert into public.tasks (organization_id, title, meeting_id)
  select org_a, 'x', '99999999-0000-0000-0000-000000000009' from ctx$$, '23503', null, 'reunião inexistente');

-- ================================================ recorrência e ocorrências
-- Diária, 3 ocorrências.
select lives_ok($$insert into public.recurrence_rules (organization_id, frequency, interval_value, occurrence_limit, starts_on, timezone)
  select org_a, 'daily', 1, 3, '2026-12-01', 'UTC' from ctx$$, 'cria regra diária');
select lives_ok($$insert into public.calendar_events (organization_id, title, starts_at, ends_at, timezone, recurrence_rule_id)
  select org_a, 'Standup', '2026-12-01T09:00:00Z', '2026-12-01T09:15:00Z', 'UTC', (select r.id from public.recurrence_rules r where r.starts_on = '2026-12-01') from ctx$$,
  'evento recorrente diário');
select is((select count(*)::int from public.list_calendar_occurrences('2026-12-01', '2026-12-31')
            where title = 'Standup'), 3, 'limite de 3 ocorrências respeitado');

-- Semanal seg/qua com término.
select lives_ok($$insert into public.recurrence_rules (organization_id, frequency, by_weekday, ends_on, starts_on, timezone)
  select org_a, 'weekly', '{1,3}', '2026-12-16', '2026-12-07', 'UTC' from ctx$$,
  'cria regra semanal');
select lives_ok($$insert into public.calendar_events (organization_id, title, starts_at, ends_at, timezone, recurrence_rule_id)
  select org_a, 'Aula', '2026-12-07T18:00:00Z', '2026-12-07T19:00:00Z', 'UTC', (select r.id from public.recurrence_rules r where r.starts_on = '2026-12-07') from ctx$$,
  'evento semanal (segunda é segunda)');
select is((select array_agg(occurrence_date order by occurrence_date)
             from public.list_calendar_occurrences('2026-12-01', '2027-01-31') where title = 'Aula'),
  array['2026-12-07', '2026-12-09', '2026-12-14', '2026-12-16']::date[], 'semanal seg/qua até ends_on');
select throws_ok($$update public.recurrence_rules set by_weekday = '{2,4}'
  where starts_on = '2026-12-07'$$, '23514', null,
  'dias da semana precisam incluir o dia do primeiro evento');

-- Horário de verão: 09:00 em Nova York permanece 09:00 local.
select lives_ok($$insert into public.recurrence_rules (organization_id, frequency, starts_on, timezone)
  select org_a, 'weekly', '2026-03-02', 'America/New_York' from ctx$$,
  'regra semanal em Nova York');
select lives_ok($$insert into public.calendar_events (organization_id, title, starts_at, ends_at, timezone, recurrence_rule_id)
  select org_a, 'Call NY', '2026-03-02T14:00:00Z', '2026-03-02T15:00:00Z', 'America/New_York', (select r.id from public.recurrence_rules r where r.starts_on = '2026-03-02') from ctx$$,
  'evento 09:00 NY (EST)');
select is((select array_agg(occurrence_start order by occurrence_start)
             from public.list_calendar_occurrences('2026-03-01', '2026-03-20') where title = 'Call NY'),
  array['2026-03-02T14:00:00Z', '2026-03-09T13:00:00Z', '2026-03-16T13:00:00Z']::timestamptz[],
  'após o início do horário de verão o UTC muda (14:00 → 13:00)');

-- Mensal no dia 31 pula meses sem 31.
select lives_ok($$insert into public.recurrence_rules (organization_id, frequency, starts_on, timezone)
  select org_a, 'monthly', '2027-01-31', 'UTC' from ctx$$, 'regra mensal');
select lives_ok($$insert into public.calendar_events (organization_id, title, starts_at, ends_at, timezone, recurrence_rule_id)
  select org_a, 'Fechamento', '2027-01-31T12:00:00Z', '2027-01-31T13:00:00Z', 'UTC', (select r.id from public.recurrence_rules r where r.starts_on = '2027-01-31') from ctx$$,
  'evento mensal no dia 31');
select is((select array_agg(occurrence_date order by occurrence_date)
             from public.list_calendar_occurrences('2027-01-01', '2027-04-02') where title = 'Fechamento'),
  array['2027-01-31', '2027-03-31']::date[], 'meses sem dia 31 são ignorados');

-- Cancelar a série; janela inválida.
select lives_ok($$update public.calendar_events set status = 'cancelled' where title = 'Standup'$$, 'cancela a série');
select is((select count(*)::int from public.list_calendar_occurrences('2026-12-01', '2026-12-31')
            where title = 'Standup'), 0, 'série cancelada não gera ocorrências');
select throws_ok($$select * from public.list_calendar_occurrences('2026-01-01', '2026-12-31')$$,
  '22023', null, 'janela maior que 93 dias é rejeitada');
reset role;

-- ============================================================ C (member)
select public.t_act_as('cccccccc-0000-0000-0000-000000000003');
select ok((select count(*) from public.list_calendar_occurrences('2026-11-01', '2026-11-30')) >= 4,
  'member lê a agenda');
select throws_ok($$insert into public.calendar_events (organization_id, title, starts_at, ends_at, timezone)
  select org_a, 'por member', '2026-11-03T13:00:00Z', '2026-11-03T14:00:00Z', 'UTC' from ctx$$,
  '42501', null, 'member não cria evento');
select is(public.t_rowcount($$update public.meetings set notes = 'golpe'$$), 0, 'member não altera reunião');
reset role;

-- ============================================================ B isolado / anon
select public.t_act_as('bbbbbbbb-0000-0000-0000-000000000002');
select is((select count(*)::int from public.list_calendar_occurrences('2026-01-01', '2026-03-31')), 0,
  'B não vê ocorrências de A');
select is((select count(*)::int from public.meetings), 0, 'B não lê reuniões de A');
reset role;

select ok(not has_function_privilege('anon', 'public.list_calendar_occurrences(timestamptz, timestamptz)', 'EXECUTE'),
  'anon não executa a expansão de agenda');

select * from finish();
rollback;

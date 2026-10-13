-- Fase 6: user_preferences (fuso) e activity_logs (trilha imutável gravada por trigger).
begin;
create extension if not exists pgtap with schema extensions;
select plan(31);

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

insert into public.organization_members (organization_id, user_id, role)
  select org_a, 'cccccccc-0000-0000-0000-000000000003', 'member' from ctx;

-- ============================================================ A: preferências
select public.t_act_as('aaaaaaaa-0000-0000-0000-000000000001');

select lives_ok($$insert into public.user_preferences (user_id, timezone)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'America/Sao_Paulo')$$, 'A grava o próprio fuso');
select throws_ok($$insert into public.user_preferences (user_id, timezone)
  values ('bbbbbbbb-0000-0000-0000-000000000002', 'UTC')$$, '42501', null, 'A não grava preferência de B');
select throws_ok($$update public.user_preferences set timezone = 'Mars/Olympus'$$, '23514', null,
  'fuso inválido é rejeitado');
select lives_ok($$update public.user_preferences set timezone = 'Europe/Lisbon'$$, 'A altera o fuso');
select throws_ok($$delete from public.user_preferences$$, '42501', null, 'cliente não apaga preferências');
select throws_ok($$update public.user_preferences set user_id = 'bbbbbbbb-0000-0000-0000-000000000002'$$,
  '42501', null, 'user_id é imutável');

-- ============================================================ A: trilha
select lives_ok($$insert into public.tasks (organization_id, title)
  select org_a, 'Enviar proposta' from ctx$$, 'cria tarefa');
select is((select action || ':' || (changes->>'title') from public.activity_logs
            where entity_id = (select id from public.tasks where organization_id = (select org_a from ctx) and title like 'Enviar proposta%')),
  'created:Enviar proposta', 'criação registrada com o título');

update public.tasks set title = 'Enviar proposta v2' where id = (select id from public.tasks where organization_id = (select org_a from ctx) and title like 'Enviar proposta%');
select is((select changes->'title' from public.activity_logs
            where entity_id = (select id from public.tasks where organization_id = (select org_a from ctx) and title like 'Enviar proposta%') and action = 'updated'),
  '{"from": "Enviar proposta", "to": "Enviar proposta v2"}'::jsonb, 'alteração guarda from/to');

update public.tasks set title = 'Enviar proposta v2' where id = (select id from public.tasks where organization_id = (select org_a from ctx) and title like 'Enviar proposta%');
select is((select count(*)::int from public.activity_logs
            where entity_id = (select id from public.tasks where organization_id = (select org_a from ctx) and title like 'Enviar proposta%')), 2,
  'UPDATE sem diferença não gera registro');

update public.tasks set status = 'done' where id = (select id from public.tasks where organization_id = (select org_a from ctx) and title like 'Enviar proposta%');
select is((select changes ? 'completed_at' from public.activity_logs
            where entity_id = (select id from public.tasks where organization_id = (select org_a from ctx) and title like 'Enviar proposta%') and action = 'status_changed'),
  false, 'status mudou; completed_at (derivado) não entra no diff');
select is((select count(*)::int from public.activity_logs
            where entity_id = (select id from public.tasks where organization_id = (select org_a from ctx) and title like 'Enviar proposta%') and action = 'status_changed'), 1,
  'mudança de status registrada');

update public.tasks set description = 'texto muito longo e sigiloso' where id = (select id from public.tasks where organization_id = (select org_a from ctx) and title like 'Enviar proposta%');
select is((select changes from public.activity_logs
            where entity_id = (select id from public.tasks where organization_id = (select org_a from ctx) and title like 'Enviar proposta%')
            order by created_at desc, id desc limit 1),
  '{"description": {"changed": true}}'::jsonb, 'texto longo registra só que mudou');

select lives_ok($$insert into public.clients (organization_id, name)
  select org_a, 'Cliente A' from ctx$$, 'cria cliente');
update public.clients set archived_at = now() where id = (select id from public.clients where name = 'Cliente A');
select is((select count(*)::int from public.activity_logs
            where entity_id = (select id from public.clients where name = 'Cliente A') and action = 'archived'), 1,
  'arquivamento registrado');
update public.clients set archived_at = null where id = (select id from public.clients where name = 'Cliente A');
select is((select count(*)::int from public.activity_logs
            where entity_id = (select id from public.clients where name = 'Cliente A') and action = 'unarchived'), 1,
  'desarquivamento registrado');

select lives_ok($$insert into public.projects (organization_id, name)
  select org_a, 'Projeto A' from ctx$$, 'cria projeto');
select is((select entity_type from public.activity_logs
            where entity_id = (select id from public.projects where name = 'Projeto A')), 'project', 'projeto registrado');

select lives_ok($$insert into public.calendar_events (organization_id, title, starts_at, ends_at, timezone)
  select org_a, 'Dentista', '2026-11-03T13:00:00Z', '2026-11-03T14:00:00Z', 'UTC' from ctx$$,
  'cria evento');
select lives_ok($$insert into public.calendar_events (organization_id, title, starts_at, ends_at, timezone, event_type, task_id)
  select org_a, 'Foco', '2026-11-04T13:00:00Z', '2026-11-04T14:00:00Z', 'UTC', 'work_block', (select id from public.tasks where organization_id = (select org_a from ctx) and title like 'Enviar proposta%') from ctx$$,
  'cria work block');
select is((select count(*)::int from public.activity_logs where entity_type = 'calendar_event'), 1,
  'work block não polui a trilha (só o evento)');

-- Imutabilidade para o cliente.
select throws_ok($$insert into public.activity_logs (organization_id, entity_type, entity_id, action)
  select org_a, 'task', gen_random_uuid(), 'created' from ctx$$, '42501', null, 'cliente não cria registros');
select throws_ok($$update public.activity_logs set action = 'updated'$$, '42501', null, 'cliente não altera registros');
select throws_ok($$delete from public.activity_logs$$, '42501', null, 'cliente não apaga registros');
select ok((select actor_id from public.activity_logs where action = 'created' and entity_type = 'task') =
  'aaaaaaaa-0000-0000-0000-000000000001', 'autor é o usuário autenticado');
reset role;

-- ============================================================ C (member) e B (isolado)
select public.t_act_as('cccccccc-0000-0000-0000-000000000003');
select ok((select count(*) from public.activity_logs) > 0, 'member lê a trilha da organização');
select is((select count(*)::int from public.user_preferences), 0, 'member não lê preferências de A');
reset role;

select public.t_act_as('bbbbbbbb-0000-0000-0000-000000000002');
select is((select count(*)::int from public.activity_logs
            where entity_id = (select id from public.tasks where organization_id = (select org_a from ctx) and title like 'Enviar proposta%')), 0, 'B não lê a trilha de A');
select is((select count(*)::int from public.user_preferences), 0, 'B não lê preferências de A');
reset role;

select ok(not has_table_privilege('anon', 'public.activity_logs', 'SELECT'), 'anon sem acesso à trilha');
select ok(not has_table_privilege('anon', 'public.user_preferences', 'SELECT'), 'anon sem acesso às preferências');

select * from finish();
rollback;

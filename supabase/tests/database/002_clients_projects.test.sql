-- Fase 2: isolamento entre tenants, FK composta, CHECKs e escrita restrita.
begin;
create extension if not exists pgtap with schema extensions;
select plan(33);

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

-- Dados do tenant B (inseridos como superusuário).
insert into public.clients (id, organization_id, name)
  select 'bbbbbbbb-1111-0000-0000-000000000001', org_b, 'Cliente de B' from ctx;
insert into public.projects (id, organization_id, name, client_id)
  select 'bbbbbbbb-2222-0000-0000-000000000001', org_b, 'Projeto de B', 'bbbbbbbb-1111-0000-0000-000000000001' from ctx;

-- C é member (não owner) da organização A.
insert into public.organization_members (organization_id, user_id, role)
  select org_a, 'cccccccc-0000-0000-0000-000000000003', 'member' from ctx;

-- ============================================================ A (owner)
select public.t_act_as('aaaaaaaa-0000-0000-0000-000000000001');

select lives_ok($$insert into public.clients (organization_id, name, email)
  select org_a, 'Cliente A', 'c@a.com' from ctx$$, 'owner cria cliente');
select lives_ok($$insert into public.projects (organization_id, name)
  select org_a, 'Projeto sem cliente' from ctx$$, 'projeto sem cliente é permitido');
select lives_ok($$insert into public.projects (organization_id, name, client_id)
  select org_a, 'Projeto com cliente', c.id from ctx, public.clients c where c.name = 'Cliente A'$$,
  'projeto com cliente da mesma organização');

select is((select count(*)::int from public.clients), 1, 'A vê só os próprios clientes');
select is((select count(*)::int from public.projects), 2, 'A vê só os próprios projetos');

select throws_ok($$insert into public.projects (organization_id, name, client_id)
  select org_a, 'cruzado', 'bbbbbbbb-1111-0000-0000-000000000001' from ctx$$,
  '23503', null, 'FK composta impede projeto de A apontar para cliente de B');
select throws_ok($$update public.projects set client_id = 'bbbbbbbb-1111-0000-0000-000000000001'
  where name = 'Projeto sem cliente'$$, '23503', null, 'FK composta impede reapontar para cliente de B');
select throws_ok($$insert into public.clients (organization_id, name)
  select org_b, 'invasor' from ctx$$, '42501', null, 'A não cria cliente na organização B');
select throws_ok($$insert into public.projects (organization_id, name)
  select org_b, 'invasor' from ctx$$, '42501', null, 'A não cria projeto na organização B');
select is(public.t_rowcount($$update public.clients set name = 'x'
  where id = 'bbbbbbbb-1111-0000-0000-000000000001'$$), 0, 'A não altera cliente de B');
select throws_ok($$update public.clients set organization_id = (select org_b from ctx)
  where name = 'Cliente A'$$, '42501', null, 'organization_id é imutável');
select throws_ok($$update public.projects set organization_id = (select org_b from ctx)
  where name = 'Projeto sem cliente'$$, '42501', null, 'organization_id do projeto é imutável');
select throws_ok($$delete from public.clients$$, '42501', null, 'cliente não apaga clientes');
select throws_ok($$delete from public.projects$$, '42501', null, 'cliente não apaga projetos');

select lives_ok($$update public.clients set archived_at = now() where name = 'Cliente A'$$, 'owner arquiva cliente');
select is((select count(*)::int from public.projects where client_id is not null), 1,
  'arquivar cliente não afeta os projetos vinculados');
select lives_ok($$update public.projects set archived_at = now() where name = 'Projeto com cliente'$$,
  'owner arquiva projeto');

-- CHECKs
select throws_ok($$insert into public.projects (organization_id, name, status)
  select org_a, 'p', 'inexistente' from ctx$$, '23514', null, 'status de projeto inválido');
select throws_ok($$insert into public.projects (organization_id, name, started_on, target_date)
  select org_a, 'p', '2026-10-10', '2026-10-01' from ctx$$, '23514', null, 'prazo anterior ao início');
select throws_ok($$insert into public.clients (organization_id, name)
  select org_a, '   ' from ctx$$, '23514', null, 'nome em branco é rejeitado');
select throws_ok($$insert into public.clients (organization_id, name, email)
  select org_a, 'x', 'sem-arroba' from ctx$$, '23514', null, 'e-mail inválido é rejeitado');

-- Logs de projeto
select lives_ok($$insert into public.project_logs (organization_id, project_id, author_id, title, content)
  select org_a, p.id, 'aaaaaaaa-0000-0000-0000-000000000001', 'Kickoff', 'ok'
    from ctx, public.projects p where p.name = 'Projeto sem cliente'$$, 'owner registra histórico como autor');
select throws_ok($$insert into public.project_logs (organization_id, project_id, author_id, title)
  select org_a, p.id, 'bbbbbbbb-0000-0000-0000-000000000002', 'Falso'
    from ctx, public.projects p where p.name = 'Projeto sem cliente'$$, '42501', null, 'autor falsificado é rejeitado');
select throws_ok($$insert into public.project_logs (organization_id, project_id, author_id, title)
  select org_a, 'bbbbbbbb-2222-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'cruzado'
    from ctx$$, '23503', null, 'log não referencia projeto de outra organização');
select is(public.t_rowcount($$update public.project_logs set title = 'Kickoff 2'$$), 1, 'autor edita o próprio log');
select throws_ok($$delete from public.project_logs$$, '42501', null, 'cliente não apaga logs');
select throws_ok($$update public.project_logs set author_id = 'bbbbbbbb-0000-0000-0000-000000000002'$$,
  '42501', null, 'author_id é imutável');
reset role;

-- ============================================================ C (member)
select public.t_act_as('cccccccc-0000-0000-0000-000000000003');
select is((select count(*)::int from public.projects), 2, 'member lê projetos da organização');
select throws_ok($$insert into public.clients (organization_id, name)
  select org_a, 'por member' from ctx$$, '42501', null, 'member não cria cliente');
select is(public.t_rowcount($$update public.projects set name = 'golpe'$$), 0, 'member não altera projeto');
select is(public.t_rowcount($$update public.project_logs set title = 'golpe'$$), 0, 'member não altera log');
reset role;

-- ============================================================ B vê só o seu
select public.t_act_as('bbbbbbbb-0000-0000-0000-000000000002');
select is((select count(*)::int from public.clients where name = 'Cliente A'), 0, 'B não lê clientes de A');
select is((select count(*)::int from public.project_logs), 0, 'B não lê logs de A');
reset role;

select * from finish();
rollback;

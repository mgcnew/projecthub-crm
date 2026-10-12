-- Fase 1: provisionamento, isolamento entre tenants e prevenção de escalonamento de privilégio.
begin;
create extension if not exists pgtap with schema extensions;
select plan(43);

-- Auxiliares (descartados no rollback).
create function public.t_rowcount(p_sql text) returns int
language plpgsql as $$
declare n int;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
end $$;

create function public.t_act_as(p_uid uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

create function public.t_act_as_anon() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  set local role anon;
end $$;

-- Dois usuários reais (criados via auth.users: o trigger provisiona).
insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@test.local', 'authenticated', 'authenticated', '{"display_name":"Alice"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@test.local', 'authenticated', 'authenticated', '{}'),
  ('cccccccc-0000-0000-0000-000000000003', 'c@test.local', 'authenticated', 'authenticated', '{}');

-- ============================================================ provisionamento
select is((select count(*)::int from public.organizations where created_by = 'aaaaaaaa-0000-0000-0000-000000000001'), 1,
  'usuário novo recebe exatamente 1 organização pessoal');
select is((select role || '/' || status from public.organization_members
            where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 'owner/active',
  'usuário novo é owner ativo da própria organização');
select is((select display_name from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000001'), 'Alice',
  'perfil usa display_name do metadata');
select is((select display_name from public.profiles where id = 'bbbbbbbb-0000-0000-0000-000000000002'), 'b',
  'perfil cai para a parte local do e-mail');

select is(
  private.ensure_personal_workspace('aaaaaaaa-0000-0000-0000-000000000001'),
  (select organization_id from public.organization_members where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  'provisionamento repetido devolve a mesma organização');
select is((select count(*)::int from public.organizations where created_by = 'aaaaaaaa-0000-0000-0000-000000000001'), 1,
  'provisionamento repetido não duplica organização');
select is((select count(*)::int from public.organization_members where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 1,
  'provisionamento repetido não duplica vínculo');
select throws_ok(
  $$select private.ensure_personal_workspace('99999999-0000-0000-0000-000000000009')$$,
  '23503', null, 'provisionamento falha para usuário inexistente');

-- ==================================================== isolamento (usuário A)
select public.t_act_as('aaaaaaaa-0000-0000-0000-000000000001');

select is((select count(*)::int from public.organizations), 1, 'A vê apenas a própria organização');
select is((select count(*)::int from public.organization_members), 1, 'A vê apenas o próprio vínculo');
select is((select count(*)::int from public.profiles), 1, 'A vê apenas o próprio perfil');
select is((select count(*)::int from public.organizations where created_by = 'bbbbbbbb-0000-0000-0000-000000000002'), 0,
  'A não lê a organização de B');
select is((select count(*)::int from public.profiles where id = 'bbbbbbbb-0000-0000-0000-000000000002'), 0,
  'A não lê o perfil de B');

-- Escrita permitida: nome da própria organização e do próprio perfil.
select is(public.t_rowcount($$update public.organizations set name = 'Casa da Alice'$$), 1,
  'owner atualiza o nome da própria organização');
select is(public.t_rowcount($$update public.profiles set display_name = 'Alice S.' where id = auth.uid()$$), 1,
  'usuário atualiza o próprio display_name');

-- Escrita negada.
select is(public.t_rowcount($$update public.organizations set name = 'invadida'
  where created_by = 'bbbbbbbb-0000-0000-0000-000000000002'$$), 0,
  'A não altera a organização de B (0 linhas)');
select is(public.t_rowcount($$update public.profiles set display_name = 'x'
  where id = 'bbbbbbbb-0000-0000-0000-000000000002'$$), 0,
  'A não altera o perfil de B (0 linhas)');
select throws_ok($$update public.organizations set slug = 'outro-slug'$$, '42501', null,
  'slug é imutável para o cliente');
select throws_ok($$update public.organizations set created_by = 'bbbbbbbb-0000-0000-0000-000000000002'$$, '42501', null,
  'created_by é imutável para o cliente');
select throws_ok($$update public.profiles set id = 'bbbbbbbb-0000-0000-0000-000000000002'$$, '42501', null,
  'id do perfil é imutável para o cliente');
select throws_ok($$update public.organization_members set role = 'owner'$$, '42501', null,
  'cliente não altera role');
select throws_ok($$update public.organization_members set status = 'active'$$, '42501', null,
  'cliente não altera status');
select throws_ok($$insert into public.organization_members (organization_id, user_id, role)
  select organization_id, 'bbbbbbbb-0000-0000-0000-000000000002', 'owner' from public.organization_members$$,
  '42501', null, 'cliente não insere vínculo (nem de outro usuário como owner)');
select throws_ok($$delete from public.organization_members$$, '42501', null,
  'cliente não apaga vínculo');
select throws_ok($$insert into public.organizations (name, slug, created_by)
  values ('x', 'x-org', 'aaaaaaaa-0000-0000-0000-000000000001')$$, '42501', null,
  'cliente não cria organização diretamente');
select throws_ok($$delete from public.organizations$$, '42501', null,
  'cliente não apaga organização');
select throws_ok($$insert into public.profiles (id, display_name)
  values ('cccccccc-0000-0000-0000-000000000003', 'x')$$, '42501', null,
  'cliente não insere perfil');
select throws_ok($$select private.ensure_personal_workspace('aaaaaaaa-0000-0000-0000-000000000001')$$,
  '42501', null, 'cliente não executa o provisionamento privilegiado');

reset role;

-- ============================================== usuário sem vínculo ativo / B
select public.t_act_as('bbbbbbbb-0000-0000-0000-000000000002');
select is(public.t_rowcount($$update public.organizations set name = 'Casa da Bia'$$), 1,
  'B atualiza apenas a própria organização');
reset role;
select is((select name from public.organizations where created_by = 'aaaaaaaa-0000-0000-0000-000000000001'), 'Casa da Alice',
  'a organização de A permaneceu intacta');

-- =============================================================== member x owner
insert into public.organization_members (organization_id, user_id, role)
select organization_id, 'bbbbbbbb-0000-0000-0000-000000000002', 'member'
  from public.organization_members where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';

select public.t_act_as('bbbbbbbb-0000-0000-0000-000000000002');
select is((select count(*)::int from public.organizations
            where created_by = 'aaaaaaaa-0000-0000-0000-000000000001'), 1,
  'member ativo enxerga a organização do owner');
select is(public.t_rowcount($$update public.organizations set name = 'golpe'
  where created_by = 'aaaaaaaa-0000-0000-0000-000000000001'$$), 0,
  'member (não owner) não altera a organização');
reset role;

-- ====================================================================== suspenso
update public.organization_members set status = 'suspended'
 where user_id = 'bbbbbbbb-0000-0000-0000-000000000002'
   and organization_id = (select id from public.organizations where created_by = 'aaaaaaaa-0000-0000-0000-000000000001');

select public.t_act_as('bbbbbbbb-0000-0000-0000-000000000002');
select is((select count(*)::int from public.organizations
            where created_by = 'aaaaaaaa-0000-0000-0000-000000000001'), 0,
  'membro suspenso não enxerga a organização');
select is((select count(*)::int from public.organization_members
            where organization_id = (select id from public.organizations where created_by = 'aaaaaaaa-0000-0000-0000-000000000001')), 0,
  'membro suspenso não enxerga os vínculos');
reset role;

-- ================================================================= anônimo
select public.t_act_as_anon();
select throws_ok($$select * from public.organizations$$, '42501', null, 'anon não lê organizations');
select throws_ok($$select * from public.organization_members$$, '42501', null, 'anon não lê organization_members');
select throws_ok($$select * from public.profiles$$, '42501', null, 'anon não lê profiles');
reset role;

-- ============================================================= último owner
select throws_ok(
  $$update public.organization_members set role = 'member'
     where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  '23514', null, 'último owner não pode ser rebaixado');
select throws_ok(
  $$delete from public.organization_members where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  '23514', null, 'último owner não pode ser removido');
select throws_ok(
  $$update public.organization_members set status = 'suspended'
     where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  '23514', null, 'último owner não pode ser suspenso');

-- Com segundo owner, o primeiro pode sair.
update public.organization_members set role = 'owner', status = 'active'
 where user_id = 'bbbbbbbb-0000-0000-0000-000000000002'
   and organization_id = (select id from public.organizations where created_by = 'aaaaaaaa-0000-0000-0000-000000000001');
select lives_ok(
  $$update public.organization_members set role = 'member'
     where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  'com outro owner ativo, o rebaixamento é permitido');

-- ============================================================ superfície de API
select ok(not has_schema_privilege('anon', 'private', 'USAGE'), 'anon não usa o schema private');
select ok(not has_function_privilege('anon', 'private.is_active_member(uuid)', 'EXECUTE'),
  'anon não executa helpers privados');

select * from finish();
rollback;

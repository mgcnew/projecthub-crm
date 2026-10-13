-- D082: com fator TOTP verificado, a sessão só acessa dados com aal2. Sem fator (ou com fator não
-- verificado), nada muda. A política restritiva `mfa_required` existe em toda tabela de public.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

create function public.t_act_as(p_uid uuid, p_aal text default null) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_strip_nulls(json_build_object('sub', p_uid, 'role', 'authenticated', 'aal', p_aal))::text, true);
  set local role authenticated;
end $$;

insert into auth.users (id, email, aud, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@test.local', 'authenticated', 'authenticated'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@test.local', 'authenticated', 'authenticated'),
  ('cccccccc-0000-0000-0000-000000000003', 'c@test.local', 'authenticated', 'authenticated');

create temp table ctx as
select (select id from public.organizations where created_by = 'aaaaaaaa-0000-0000-0000-000000000001') as org_a;
grant select on ctx to authenticated;

-- B nunca ativou MFA: aal1 basta.
select public.t_act_as('bbbbbbbb-0000-0000-0000-000000000002', 'aal1');
select is((select count(*)::int from public.organizations), 1, 'sem fator, a sessão aal1 enxerga a organização');
reset role;

select public.t_act_as('aaaaaaaa-0000-0000-0000-000000000001', 'aal1');
select is((select count(*)::int from public.organizations), 1, 'A ainda sem fator: aal1 enxerga a organização');
reset role;

-- A ativa o TOTP (fator verificado); C só inicia a inscrição (fator não verificado).
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at) values
  (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000001', 'app', 'totp', 'verified', now(), now()),
  (gen_random_uuid(), 'cccccccc-0000-0000-0000-000000000003', 'app', 'totp', 'unverified', now(), now());

-- A em aal1: tudo bloqueado, leitura volta vazia e escrita falha.
select public.t_act_as('aaaaaaaa-0000-0000-0000-000000000001', 'aal1');
select is((select count(*)::int from public.organizations), 0, 'com fator verificado, aal1 não enxerga nada');
select throws_ok($$insert into public.clients (organization_id, name) select org_a, 'Cliente MFA' from ctx$$,
  '42501', null, 'com fator verificado, aal1 não grava');
select is((select private.mfa_satisfied()), false, 'mfa_satisfied é falso em aal1 com fator verificado');
reset role;

-- A em aal2: acesso normal.
select public.t_act_as('aaaaaaaa-0000-0000-0000-000000000001', 'aal2');
select is((select count(*)::int from public.organizations), 1, 'aal2 enxerga a organização');
select lives_ok($$insert into public.clients (organization_id, name) select org_a, 'Cliente MFA' from ctx$$,
  'aal2 grava normalmente');
select is((select private.mfa_satisfied()), true, 'mfa_satisfied é verdadeiro em aal2');
reset role;

-- C com fator não verificado continua em aal1 sem perda de acesso.
select public.t_act_as('cccccccc-0000-0000-0000-000000000003', 'aal1');
select is((select count(*)::int from public.organizations), 1, 'fator não verificado não exige aal2');
reset role;

-- Toda tabela de public tem a política restritiva (tabela nova sem ela falha aqui).
select is(
  (select coalesce(string_agg(c.relname, ', ' order by c.relname), '')
     from pg_class c
    where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
      and not exists (
        select 1 from pg_policies p
         where p.schemaname = 'public' and p.tablename = c.relname
           and p.policyname = 'mfa_required' and p.permissive = 'RESTRICTIVE')),
  '', 'toda tabela de public tem a política restritiva mfa_required');

select * from finish();
rollback;

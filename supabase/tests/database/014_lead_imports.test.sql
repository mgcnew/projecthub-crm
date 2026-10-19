-- Fase 7.2: histórico de importações.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

create function public.t_rowcount(p_sql text) returns int language plpgsql as $$
declare n int; begin execute p_sql; get diagnostics n = row_count; return n; end $$;
create function public.t_act_as(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

insert into auth.users (id, email, aud, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@test.local', 'authenticated', 'authenticated'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@test.local', 'authenticated', 'authenticated');
create temp table ctx as
select (select id from public.organizations where created_by = 'aaaaaaaa-0000-0000-0000-000000000001') as org_a;
grant select on ctx to authenticated;

select public.t_act_as('aaaaaaaa-0000-0000-0000-000000000001');
select lives_ok($$insert into public.lead_imports (organization_id, file_name, source, total, created, updated, skipped, errors)
  select org_a, 'leads.csv', 'Planilha out/2026', 20, 15, 1, 4, '[{"line": 3, "reason": "Telefone inválido"}]' from ctx$$,
  'owner registra a importação');
select throws_ok($$insert into public.lead_imports (organization_id, file_name, source, total, created)
  select org_a, 'x.csv', 'x', 5, 6 from ctx$$, '23514', null, 'contagens não passam do total');
select throws_ok($$insert into public.lead_imports (organization_id, file_name, source, total)
  select org_a, 'x.csv', 'x', 5001 from ctx$$, '23514', null, 'limite de 5.000 linhas por arquivo');
select throws_ok($$insert into public.lead_imports (organization_id, file_name, source, total, errors)
  select org_a, 'x.csv', 'x', 1, '{"line": 1}' from ctx$$, '23514', null, 'erros precisam ser uma lista');
select throws_ok($$update public.lead_imports set created = 0$$, '42501', null, 'histórico não é alterado pelo cliente');
reset role;

select public.t_act_as('bbbbbbbb-0000-0000-0000-000000000002');
select is((select count(*)::int from public.lead_imports), 0, 'B não enxerga importações de A');
select throws_ok($$insert into public.lead_imports (organization_id, file_name, source, total) select org_a, 'x', 'x', 1 from ctx$$,
  '42501', null, 'B não registra importação em A');
reset role;

select * from finish();
rollback;

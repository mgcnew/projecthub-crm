-- D086: diretório de acessos. Isolamento entre organizações, escrita só do owner, URL só http(s),
-- FK composta, sem coluna de segredo e sem trilha de atividade.
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

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
       (select id from public.organizations where created_by = 'bbbbbbbb-0000-0000-0000-000000000002') as org_b,
       null::uuid as project_b;
grant select on ctx to authenticated;

-- C é membro (não owner) da organização A.
insert into public.organization_members (organization_id, user_id, role)
  select org_a, 'cccccccc-0000-0000-0000-000000000003', 'member' from ctx;

-- Projeto de B (id explícito, como um cliente malicioso que o conhecesse): A não pode referenciá-lo.
insert into public.projects (organization_id, name) select org_b, 'Projeto de B' from ctx;
update ctx set project_b = (select id from public.projects where name = 'Projeto de B');

-- A: owner cria, lê, edita.
select public.t_act_as('aaaaaaaa-0000-0000-0000-000000000001');
select lives_ok($$insert into public.access_entries (organization_id, name, category, url, username, manager_item)
  select org_a, 'Supabase', 'Banco de dados', 'https://supabase.com/dashboard', 'eu@exemplo.com', 'Supabase (pessoal)' from ctx$$,
  'owner cria acesso');
select is((select count(*)::int from public.access_entries), 1, 'owner enxerga o próprio acesso');
select lives_ok($$update public.access_entries set username = 'outro@exemplo.com'$$, 'owner edita');
select lives_ok($$update public.access_entries set archived_at = now()$$, 'owner arquiva');

-- Restrições
select throws_ok($$insert into public.access_entries (organization_id, name, url) select org_a, 'X', 'javascript:alert(1)' from ctx$$,
  '23514', null, 'URL que não é http(s) é rejeitada');
select throws_ok($$insert into public.access_entries (organization_id, name, url) select org_a, 'X', 'https://a b.com' from ctx$$,
  '23514', null, 'URL com espaço é rejeitada');
select throws_ok($$insert into public.access_entries (organization_id, name, project_id)
  select org_a, 'X', project_b from ctx$$,
  '23503', null, 'FK composta: A não referencia projeto da organização B');
select throws_ok($$insert into public.access_entries (organization_id, name) select org_b, 'Invasão' from ctx$$,
  '42501', null, 'A não grava na organização de B');
reset role;

-- Não existe coluna capaz de guardar segredo.
select is(
  (select coalesce(string_agg(column_name, ', ' order by column_name), '')
     from information_schema.columns
    where table_schema = 'public' and table_name = 'access_entries'
      and column_name ~* '(pass|senha|secret|token|key|credential)'),
  '', 'sem colunas de senha, segredo, token ou chave');

-- Sem trilha de atividade.
select is((select count(*)::int from public.activity_logs where entity_type not in ('task', 'project', 'client', 'calendar_event')), 0,
  'o diretório não gera registros em activity_logs');

-- B não enxerga o acesso de A.
select public.t_act_as('bbbbbbbb-0000-0000-0000-000000000002');
select is((select count(*)::int from public.access_entries), 0, 'B não enxerga acessos de A');
select is(public.t_rowcount($$delete from public.access_entries$$), 0, 'B não apaga acessos de A');
reset role;

-- C (membro): lê, não escreve.
select public.t_act_as('cccccccc-0000-0000-0000-000000000003');
select is((select count(*)::int from public.access_entries), 1, 'membro enxerga os acessos da organização');
select throws_ok($$insert into public.access_entries (organization_id, name) select org_a, 'Membro' from ctx$$,
  '42501', null, 'membro não cria acesso');
reset role;

-- A apaga o próprio.
select public.t_act_as('aaaaaaaa-0000-0000-0000-000000000001');
select is(public.t_rowcount($$delete from public.access_entries$$), 1, 'owner remove o próprio acesso');
reset role;

select * from finish();
rollback;

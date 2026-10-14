-- Fase 6.4: invariantes de segurança do esquema. Falham se uma migração futura expuser dados.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

-- 1) RLS em toda tabela de public
select is(
  (select coalesce(string_agg(c.relname, ', ' order by c.relname), '')
     from pg_class c
    where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p') and not c.relrowsecurity),
  '', 'toda tabela em public tem RLS habilitada');

-- 2) Sem views em public (views ignoram a RLS do chamador por padrão)
select is(
  (select count(*)::int from pg_class c
    where c.relnamespace = 'public'::regnamespace and c.relkind in ('v', 'm')),
  0, 'nenhuma view/materialized view em public');

-- 3) anon não tem nenhum privilégio em tabelas, sequências ou funções de public
select is(
  (select count(*)::int from information_schema.role_table_grants
    where table_schema = 'public' and grantee = 'anon'),
  0, 'anon sem privilégios em tabelas de public');
select is(
  (select count(*)::int from pg_proc p
    where p.pronamespace in ('public'::regnamespace, 'private'::regnamespace)
      and has_function_privilege('anon', p.oid, 'EXECUTE')),
  0, 'anon não executa nenhuma função de public/private');
select ok(not has_schema_privilege('anon', 'private', 'USAGE'), 'anon sem USAGE no schema private');

-- 4) authenticated: sem INSERT/UPDATE em nível de tabela (só por coluna), sem TRUNCATE/REFERENCES/TRIGGER
select is(
  (select coalesce(string_agg(table_name || ':' || privilege_type, ', ' order by table_name), '')
     from information_schema.role_table_grants
    where table_schema = 'public' and grantee = 'authenticated'
      and privilege_type in ('INSERT', 'UPDATE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')),
  '', 'authenticated não tem INSERT/UPDATE/TRUNCATE/REFERENCES/TRIGGER em nível de tabela');

-- 5) DELETE do cliente só nas tabelas decididas (D026, D037, D044, D048)
select is(
  (select coalesce(string_agg(table_name, ', ' order by table_name), '')
     from information_schema.role_table_grants
    where table_schema = 'public' and grantee = 'authenticated' and privilege_type = 'DELETE'),
  'access_entries, checklist_items, checklist_template_items, checklist_templates, client_contacts, project_payments, reminders, task_plans',
  'DELETE concedido apenas às tabelas sem histórico de negócio');

-- 6) Colunas de identidade/tenancy nunca são atualizáveis pelo cliente
select is(
  (select coalesce(string_agg(table_name || '.' || column_name, ', ' order by table_name), '')
     from information_schema.column_privileges
    where table_schema = 'public' and grantee = 'authenticated' and privilege_type = 'UPDATE'
      and column_name in ('id', 'organization_id', 'user_id', 'created_by', 'author_id', 'actor_id')),
  '', 'id, organization_id, user_id, created_by, author_id e actor_id são imutáveis para o cliente');

-- 7) Políticas só para authenticated, sem expressão literal true
select is(
  (select count(*)::int from pg_policies
    where schemaname = 'public' and roles <> '{authenticated}'::name[]),
  0, 'toda política de public é restrita ao papel authenticated');
select is(
  (select count(*)::int from pg_policies
    where schemaname = 'public' and (qual in ('true', '(true)') or with_check in ('true', '(true)'))),
  0, 'nenhuma política usa USING/CHECK literal true');

-- 8) Funções: SECURITY DEFINER só em private; toda definer com search_path fixo
select is(
  (select coalesce(string_agg(proname, ', ' order by proname), '')
     from pg_proc where pronamespace = 'public'::regnamespace and prosecdef),
  '', 'nenhuma função SECURITY DEFINER em public (exposta pela API)');
select is(
  (select coalesce(string_agg(proname, ', ' order by proname), '')
     from pg_proc p
    where p.pronamespace in ('public'::regnamespace, 'private'::regnamespace) and p.prosecdef
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')),
  '', 'toda SECURITY DEFINER tem search_path fixo');

-- 9) authenticated só executa as funções que a API/RLS precisam
select is(
  (select coalesce(string_agg(n.nspname || '.' || p.proname, ', ' order by n.nspname, p.proname), '')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private') and has_function_privilege('authenticated', p.oid, 'EXECUTE')),
  'private.is_active_member, private.is_active_owner, private.mfa_satisfied, public.list_calendar_occurrences',
  'authenticated executa só os helpers de RLS e a expansão da agenda');

-- 10) Multitenancy: FKs entre tabelas de tenant incluem organization_id (FK composta)
select is(
  (select coalesce(string_agg(con.conrelid::regclass || '.' || con.conname, ', ' order by con.conname), '')
     from pg_constraint con
     join pg_class c1 on c1.oid = con.conrelid and c1.relnamespace = 'public'::regnamespace
     join pg_class c2 on c2.oid = con.confrelid and c2.relnamespace = 'public'::regnamespace
    where con.contype = 'f'
      and exists (select 1 from pg_attribute a where a.attrelid = c1.oid and a.attname = 'organization_id' and not a.attisdropped)
      and exists (select 1 from pg_attribute a where a.attrelid = c2.oid and a.attname = 'organization_id' and not a.attisdropped)
      and not exists (select 1 from pg_attribute a where a.attrelid = c1.oid and a.attname = 'organization_id' and a.attnum = any (con.conkey))),
  '', 'FKs entre tabelas de tenant são compostas com organization_id');

-- 11) Superfícies laterais: Realtime e Storage não expõem nada
select is((select count(*)::int from pg_publication_tables where pubname = 'supabase_realtime'), 0,
  'nenhuma tabela publicada no Realtime');
select is((select count(*)::int from storage.buckets), 0, 'nenhum bucket de Storage');

select * from finish();
rollback;

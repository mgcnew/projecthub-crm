-- Impressão digital do esquema (colunas, políticas, funções sem comentários, privilégios, migrações).
-- Rode no banco local e no hospedado e compare as linhas: hashes iguais = esquema igual.
--   local:      docker exec -i supabase_db_<projeto> psql -U postgres -d postgres -At -F ' | ' < scripts/db-fingerprint.sql
--   hospedado:  cole no SQL Editor (ou use execute_sql do MCP do Supabase).
select 'cols' k, count(*) n, md5(string_agg(table_name||'.'||column_name||':'||data_type||':'||is_nullable||':'||coalesce(column_default,'')||':'||coalesce(generation_expression,''), '|' order by table_name, column_name)) h from information_schema.columns where table_schema='public'
union all select 'policies', count(*), md5(string_agg(tablename||policyname||cmd||coalesce(qual,'')||coalesce(with_check,''), '|' order by tablename, policyname)) from pg_policies where schemaname='public'
union all select 'funcs', count(*), md5(string_agg(n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||'):'||regexp_replace(regexp_replace(p.prosrc, '--[^\n]*', '', 'g'), '\s+', '', 'g')||':'||p.prosecdef||':'||coalesce(array_to_string(p.proconfig,','),''), '|' order by n.nspname, p.proname)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private')
union all select 'funcgrants', count(*), md5(string_agg(routine_schema||'.'||routine_name||':'||grantee||':'||privilege_type, '|' order by routine_schema, routine_name, grantee)) from information_schema.routine_privileges where routine_schema in ('public','private') and grantee in ('anon','authenticated','PUBLIC')
union all select 'migrations', count(*), max(version) from supabase_migrations.schema_migrations;

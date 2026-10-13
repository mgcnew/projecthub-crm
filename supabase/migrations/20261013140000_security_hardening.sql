-- Fase 6.4: endurecimento de segurança (revisão de RLS e privilégios).
-- Reversível: só revoga privilégios e altera default privileges; nenhum dado é tocado.

-- 1) Funções de trigger do schema private herdavam EXECUTE de PUBLIC (anon/authenticated).
--    Trigger não depende de EXECUTE do chamador; revogar não afeta o disparo.
revoke all on function private.checklist_items_completion() from public, anon, authenticated;
revoke all on function private.prevent_task_cycles() from public, anon, authenticated;
revoke all on function private.tasks_completion() from public, anon, authenticated;

-- 2) Tabelas, sequências e funções novas no schema public passam a nascer SEM acesso para
--    anon/authenticated (o padrão do Supabase concede ALL). Cada migração concede o mínimo
--    explicitamente, como já faz hoje.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated;

-- Ordenação por prioridade: `priority` é texto ('low'|'medium'|'high'|'urgent') e não ordena na ordem
-- de importância. Coluna gerada e armazenada (aditiva e reversível: basta `drop column`); o cliente
-- nunca escreve nela (generated always) e a leitura já está coberta pelo SELECT da tabela.
alter table public.tasks
  add column priority_rank smallint generated always as (
    case priority when 'urgent' then 4 when 'high' then 3 when 'medium' then 2 else 1 end
  ) stored;

create index tasks_org_priority_rank_idx on public.tasks (organization_id, priority_rank desc)
  where status in ('todo', 'in_progress');

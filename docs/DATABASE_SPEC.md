# Banco Supabase — especificação do MVP

## Estratégia escolhida
**Planejar agora; criar incrementalmente na integração com Supabase por migrações versionadas.** Primeiro Supabase local, depois ambiente hospedado de desenvolvimento, finalmente produção. Não editar esquema diretamente no dashboard sem converter a mudança em migração revisada.

## Tabelas do MVP (19)
### Identidade (3)
- `profiles`: id PK/FK auth.users, display_name, avatar_path, created_at, updated_at.
- `organizations`: id PK, name, slug unique, created_by FK auth.users, timestamps.
- `organization_members`: (organization_id,user_id) PK, role, status, joined_at.
### Projetos e clientes (3)
- `clients`: id, organization_id, name, company_name, email, phone, status, notes, archived_at, timestamps.
- `projects`: id, organization_id, client_id nullable, name, description, status, priority, started_on, target_date, archived_at, timestamps.
- `project_logs`: id, organization_id, project_id, author_id, title, content, timestamps.
### Tarefas (5)
- `tasks`: id, organization_id, project_id?, client_id?, meeting_id?, parent_task_id?, title, description, status, priority, due_date?, due_at?, estimated_minutes?, assigned_to?, recurrence_rule_id?, completed_at?, timestamps.
- `task_plans`: id, organization_id, task_id, planned_date, sort_order, status, timestamps.
- `checklist_templates`: id, organization_id, name, description, category, created_at.
- `checklist_template_items`: id, organization_id, template_id, title, sort_order.
- `checklist_items`: id, organization_id, task_id, title, is_completed, sort_order, completed_at.
### Agenda (3)
- `calendar_events`: id, organization_id, task_id?, project_id?, client_id?, title, description, event_type, starts_at, ends_at, timezone, status, recurrence_rule_id?, timestamps.
- `meetings`: id, organization_id, calendar_event_id, client_id?, project_id?, agenda, notes, decisions, status, timestamps.
- `recurrence_rules`: id, organization_id, frequency, interval_value, by_weekday, starts_on, ends_on?, occurrence_limit?, timezone, is_active, created_at.
### Notificações (3)
- `reminders`: id, organization_id, task_id? XOR event_id?, remind_at, status, created_at.
- `notifications`: id, organization_id, user_id, reminder_id?, title, body, read_at?, created_at.
- `notification_deliveries`: id, organization_id, notification_id, channel, status, attempt_count, last_error?, sent_at?, created_at.
### Configuração (2)
- `user_preferences`: user_id PK, timezone, locale, theme, sidebar_collapsed, dashboard_layout jsonb, updated_at.
- `activity_logs`: id, organization_id, actor_id, entity_type, entity_id, action, changes jsonb, created_at.

## Restrições e relacionamentos
- PK UUID, timestamps `timestamptz`, FKs explícitas; UNIQUE(organization_id,id) em alvos de FK composta.
- FKs compostas `(organization_id, related_id)` para impedir referências entre tenants.
- CHECK de enumerações/status, `ends_at > starts_at`, `estimated_minutes > 0`, `num_nonnulls(task_id,event_id)=1` em reminders.
- `work_block` exige task_id; task_plans não duplica tarefa/data ativa.
- Definir regra explícita para exclusividade entre `due_date` e `due_at` antes da migração de tarefas.
- Evitar ciclos de subtarefas (trigger/função ou validação transacional).
- Recorrência precisa de identidade estável por ocorrência e exceções antes de habilitar edição de série. Pode requerer tabela adicional `recurrence_occurrences`; as 19 tabelas são baseline, não teto rígido.
- Índices por organization_id+status/prazo/data e FKs; índices parciais para ativos e pendentes.

## Segurança RLS
- Habilitar RLS em todas as tabelas expostas.
- Acesso somente de membros ativos, com papel autorizado; no MVP apenas `owner` escreve.
- `organization_members` não admite elevação de papel por DML do cliente.
- Provisionar organização pessoal e primeiro owner por operação privilegiada transacional e idempotente; proteger último owner.
- Funções SECURITY DEFINER em schema privado não exposto, search_path fixo, privilégios mínimos, owner revisado.
- Preferências pessoais e notificações exigem também identidade do próprio usuário.
- Logs de auditoria imutáveis para o cliente, gravados por função/trigger confiável.
- Nunca expor `service_role`, segredos ou tokens no frontend.

## Migrações propostas
001 extensions / 002 identity / 003 auth helpers & bootstrap / 004 clients-projects / 005 tasks-checklists / 006 calendar-meetings-recurrence / 007 reminders-notifications / 008 preferences-audit / 009 RLS / 010 indexes & verification.

**Atenção:** aplicar RLS e grants seguros junto de cada nova tabela, antes de disponibilizá-la via API. A separação acima é lógica, não autorização para publicar tabelas sem políticas.

## Testes obrigatórios
- Usuário A não lê, altera, apaga ou referencia dados da organização B.
- Usuário suspenso/sem sessão não acessa dados.
- Usuário não altera role, organization_id, actor_id ou logs.
- Último owner não é removido.
- FK composta impede associações cruzadas.
- CHECKs de datas, status, lembretes e duração.
- Recorrência e disparos são idempotentes; fusos e mudanças de horário testados.
- Testar via sessões/JWT de usuários reais, não apenas service_role/postgres.
- Recriar banco do zero por migrações no CI; testes pgTAP e integração.

## Pendências de design antes de gerar SQL de produção
1. Política de recorrência: exceções e edição de série; escolher tabela extra ou escopo reduzido.
2. Política de exclusão/arquivamento e cascatas.
3. Atribuição de membros e transferências futuras.
4. Contratos de escrita do frontend e bootstrap idempotente.
5. Storage privado e políticas de arquivos (quando arquivos entrarem no MVP).

## Estado implementado (2026-10-13)
As 19 tabelas do MVP existem, mais `access_entries` (D086, fora da lista original): 22 no total, todas com RLS, políticas e privilégios por coluna. O esquema vem de **14 migrações**
(`supabase/migrations`), agrupadas por fase em vez das 001–010 lógicas acima (D025). O banco hospedado recebeu as
mesmas 14 (D081; conferidas por hash com `scripts/db-fingerprint.sql`).

### Divergências da especificação
| Tabela / coluna | Especificado | Implementado | Decisão |
|---|---|---|---|
| `meetings` | `client_id`, `project_id`, `status` | Não duplica; a fonte é `calendar_events` | D043 |
| `reminders` | `remind_at` apenas | Tarefa: `remind_at`; evento: `offset_minutes` por ocorrência; mais `user_id`, `status`, `updated_at` | D047 |
| `notifications` | `reminder_id`, `title`, `body` | Idem, mais `task_id`, `event_id`, `occurrence_at` (chave de idempotência) | D050 |
| `user_preferences` | `timezone`, `locale`, `theme`, `sidebar_collapsed`, `dashboard_layout` | Só `timezone` | D054 |
| `tasks.recurrence_rule_id` | Previsto | **Não criado** (tarefas recorrentes fora do MVP) | D044 |
| `tasks.priority_rank` | Não previsto | Coluna gerada para ordenar por prioridade | D076, D077 |
| `recurrence_occurrences` | Cogitada | **Não criada**: sem exceções por ocorrência | D040 |
| Políticas `mfa_required` | Não previstas | Restritiva em toda tabela de `public`; exige `aal2` de quem tem fator TOTP verificado | D082 |
| `access_entries` | Não prevista | Diretório de acessos (URL, usuário, item no gerenciador), **sem coluna de segredo**; sem trilha de atividade | D086, D087 |
| `project_payments` | Não prevista (financeiro era "futuro") | Parcelas do projeto (adiantamento, parcelas, saldo) com vencimento e situação; valores em centavos | D093–D095 |
| `clients.legal_name`, `tax_id`, `billing_email`, `website`, `address_*`, `source` | Não previstos | Cadastro completo (documento fiscal, cobrança, endereço, origem); fora da trilha de atividade | D096, D097 |
| `client_contacts` | Não prevista | Contatos do cliente (um principal por cliente) | D096 |
| `projects.contract_value_cents`, `currency`, `billing_model` | Não previstos | Valor do projeto, moeda (`BRL|USD|EUR`) e modelo de cobrança | D093 |

### Funções (todas em `private`, exceto a de leitura da agenda)
`set_updated_at`, `protect_last_owner`, `is_active_member`, `is_active_owner`, `mfa_satisfied`,
`ensure_personal_workspace`, `handle_new_user`, `tasks_completion`, `prevent_task_cycles`,
`checklist_items_completion`, `is_valid_timezone`, `calendar_events_before_write`,
`calendar_events_create_meeting`, `recurrence_rules_validate`, `reminders_before_write`,
`process_due_reminders` (agendada no `pg_cron`), `user_preferences_validate`, `log_activity` e a pública
`list_calendar_occurrences` (SECURITY INVOKER). Nenhuma função SECURITY DEFINER é pública.

### Pendências de design da lista original
1. Recorrência: escopo reduzido sem exceções (D040); exceções seguem em D009.
2. Exclusão/arquivamento: parcial (D026, D037, D044); definitiva e exclusão de conta em D010/D022.
3. Atribuição de membros: coluna `assigned_to` com FK composta existe; sem UI nem visibilidade de perfis (D023, D038).
4. Contratos de escrita e bootstrap: resolvidos (grants por coluna; provisionamento por gatilho, D021).
5. Storage privado: não há arquivos no MVP; `profiles.avatar_path` existe sem uso e nenhum bucket foi criado.


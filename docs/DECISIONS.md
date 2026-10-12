# Registro de decisões (ADR simplificado)

- D001 APROVADA: projeto pessoal agora, multitenant desde o banco.
- D002 APROVADA: Central do Dia equilibrada.
- D003 APROVADA: tarefas híbridas — prazo, dia planejado e bloco de tempo são independentes.
- D004 APROVADA: work blocks como `calendar_events` com `event_type=work_block`.
- D005 APROVADA: gestão avançada e responsividade mobile, tema claro padrão.
- D006 APROVADA: Supabase Auth/Postgres/RLS, organização padrão e privilégios mínimos.
- D007 APROVADA: planejar esquema agora, gerar/aplicar migrações incrementais durante desenvolvimento; SQL é fonte de verdade do esquema implementado.
- D008 APROVADA: módulos futuros não serão implementados antecipadamente.
- D009 PENDENTE: exceções e edição individual de recorrências; requer persistência adicional.
- D010 PENDENTE: regras definitivas de arquivamento/exclusão e cascatas.
- D011 PENDENTE: integração externa de calendário e notificações push/WhatsApp.

Ao alterar uma decisão, registrar data, motivo, impacto em banco/API/UI e migrações afetadas.

## Decisões técnicas da Fase 0 (2026-10-12)
- D012 APROVADA (a confirmar na revisão): roteamento com React Router (modo data router, `createBrowserRouter`). Impacto: apenas UI; sem banco.
- D013 APROVADA (a confirmar): Tailwind CSS v4 (plugin Vite) + shadcn/ui (estilo new-york) com tokens do UI_UX_SPEC mapeados em variáveis CSS; tema claro padrão.
- D014 APROVADA (a confirmar): Vitest + Testing Library para testes de unidade/componente; Playwright fica para a Fase 6.
- D015 APROVADA (a confirmar): CI em GitHub Actions (lint, typecheck, test, build). Jobs de banco (reset por migrações, pgTAP) entram com a Fase 1.
- D016: `@supabase/supabase-js` e o cliente Supabase não entram na Fase 0; chegam na Fase 1 junto da autenticação. Variáveis: `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` (somente valores públicos).
- D017: gerenciador de pacotes npm (lockfile versionado); Node >= 22 (`.nvmrc` = 24).
- Observação: `supabase start` exige Docker/Podman; não validado na Fase 0 por ausência de Docker no ambiente de desenvolvimento.

## Decisões técnicas da Fase 1 (2026-10-12)
- D018: papéis do MVP `owner` e `member`; status `active` e `suspended`. Somente `owner` ativo escreve (apenas `organizations.name`).
- D019: sem INSERT/UPDATE/DELETE do cliente em `organization_members`; `organizations` só aceita UPDATE de `name` (grant por coluna: `slug` e `created_by` imutáveis); `profiles` só `display_name`/`avatar_path`. Sem INSERT/DELETE do cliente nas três tabelas.
- D020: membro suspenso não enxerga a organização nem seus vínculos (política só para membros ativos). `anon` sem acesso algum.
- D021: provisionamento por trigger em `auth.users` → `private.ensure_personal_workspace` (advisory lock por usuário, `ON CONFLICT DO NOTHING`, slug determinístico `pessoal-<uuid>`). Não ressuscita vínculo suspenso. Sem RPC pública de bootstrap; usuários anteriores à migração são tratados por backfill.
- D022: `organizations.created_by` é `ON DELETE RESTRICT` e o último owner ativo é protegido por trigger: apagar usuário dono exige tratar a organização antes (fluxo de exclusão de conta é pendência futura).
- D023: `profiles` visível só ao próprio usuário; visibilidade entre co-membros fica para a decisão de atribuição de tarefas (pendência 3 do DATABASE_SPEC).
- D024: UI da Fase 1 só tem login/logout (sem cadastro público). Usuário de seed local em `supabase/seed.sql`. Antes da publicação (Fase 6), desabilitar `enable_signup` no projeto hospedado.
- D025: migrações da Fase 1 agrupadas em 2 arquivos (`identity` com tabelas+helpers+RLS+grants; `identity_bootstrap`), em vez das 001–003 lógicas do DATABASE_SPEC; RLS vai junto das tabelas, sem janela pública.
- Testes: pgTAP (`supabase/tests/database`, 43 asserts) + integração com JWT real (`tests/integration`, 8 testes). Pendente: política de senha/MFA e rate limit do Auth em ambiente hospedado.

## Decisões da Fase 2 — clientes e projetos (2026-10-12)
- D026 (fecha parcialmente D010): arquivamento por `archived_at`; **o cliente da API não tem DELETE** em `clients`, `projects` nem `project_logs`. Arquivar cliente não arquiva nem altera seus projetos. Exclusão definitiva fica para fluxo privilegiado futuro.
- D027: `projects.client_id` usa FK composta `(organization_id, client_id)` → `clients(organization_id, id)`, sem cascata; `client_id` nulo = projeto sem cliente. Reapontar para cliente de outra organização é rejeitado (23503).
- D028: escrita somente de `owner` ativo (D018); leitura por qualquer membro ativo. `organization_id` é imutável (grant por coluna), `author_id` de `project_logs` é forçado a `auth.uid()` pela política e é imutável.
- D029: enums do MVP — cliente: `active|inactive`; projeto: `planning|active|on_hold|completed|cancelled`, prioridade `low|medium|high|urgent`. Alterações exigem migração.
- D030: histórico do projeto = `project_logs` (anotações do autor, editáveis só por ele, sem exclusão). `activity_logs` de auditoria segue previsto para a migração 008.
- D031: listas com busca, filtros, arquivados e paginação no servidor (20/página). Formulários com aviso de alterações não salvas.
- Pendente (não bloqueia Fase 3): atribuição/transferência entre membros e visibilidade de perfis de co-membros.

## Decisões da Fase 3 — tarefas e checklists (2026-10-12)
- D032 (fecha pendência do DATABASE_SPEC): `due_date` e `due_at` são **mutuamente exclusivos** (`num_nonnulls(due_date, due_at) <= 1`): prazo de dia inteiro OU com hora. O front envia só um dos dois.
- D033: subtarefas por `parent_task_id` com FK composta; ciclos e auto-referência rejeitados por trigger (percurso da árvore com advisory lock por organização, profundidade máx. 100). A UI lista só filhos diretos.
- D034: aplicar modelo de checklist **copia** os itens em um único INSERT (atômico, sem RPC); `checklist_items` não guarda vínculo com o modelo, logo alterações no modelo nunca são retroativas.
- D035: `completed_at` (tarefa e item de checklist) é derivado por trigger do status; o cliente não tem grant na coluna e `done ⇔ completed_at` é CHECK.
- D036: `task_plans` — único plano `planned` por (tarefa, dia); mover/remover plano nunca toca em `tasks.due_*`. Sem reordenação por arrastar (apenas `sort_order` de inserção).
- D037: `tasks` sem DELETE para o cliente (cancela-se); `task_plans`, `checklist_*` e modelos podem ser removidos (sem histórico de negócio).
- D038: `assigned_to` usa FK composta para `organization_members(organization_id, user_id)`; na UI do MVP pessoal não há atribuição (campo existe no banco, fecha parcialmente a pendência 3).
- D039: `meeting_id` e `recurrence_rule_id` de `tasks` entram na Fase 4 (tabelas referenciadas ainda não existem). Rota `/app/tarefas/modelos` adicionada (modelos não constavam no mapa de rotas do UI_UX_SPEC) e `/app/meu-dia` implementada.
- Observação operacional: `supabase migration new` bloqueia lendo stdin fora de terminal; criar arquivos de migração diretamente com timestamp.

## Decisões da Fase 4 — agenda, reuniões e recorrência (2026-10-13)
- D040 (fecha D009 com escopo reduzido): recorrência mínima — `daily`, `weekly` (com `by_weekday`, 0=domingo) e `monthly` (mesmo dia do mês; meses sem o dia são ignorados), com `interval_value`, `ends_on` e `occurrence_limit`. **Sem exceções por ocorrência**: editar/cancelar vale para a série inteira; não há `recurrence_occurrences`. Exceções individuais ficam para uma decisão futura (nova tabela + migração).
- D041: ocorrências são **expandidas sob demanda** por `public.list_calendar_occurrences(p_from, p_to)` (SECURITY INVOKER, RLS do chamador, janela máx. 93 dias, série limitada a 3660 dias). A expansão ocorre no fuso do evento: o horário local é preservado no horário de verão (testado com `America/New_York`). Identidade estável da ocorrência: `(event_id, occurrence_start)` — base para lembretes da Fase 5.
- D042: `starts_on` e `timezone` da regra são derivados do evento por trigger (âncora da série); o cliente não os edita depois. Em série semanal, `by_weekday` precisa incluir o dia do primeiro evento. Regra inativa = só o evento-base. `work_block` não pode ser recorrente.
- D043: `meetings` não duplica `client_id`/`project_id`/`status` do evento (fonte única em `calendar_events`); a linha da reunião é criada por trigger ao inserir evento `meeting` (atômico, sem RPC de escrita). `event_type` é imutável após a criação.
- D044: `calendar_events`, `meetings` e `recurrence_rules` sem DELETE para o cliente (cancela-se o evento). `tasks.meeting_id` adicionado (FK composta). `tasks.recurrence_rule_id` **não** foi criado: tarefas recorrentes ficam fora do MVP até haver regra de geração/conclusão definida.
- D045: fuso do evento = fuso do navegador no momento da criação/edição (campo não editável na UI); o servidor valida o nome IANA. Seletor de fuso próprio e `user_preferences.timezone` ficam para a Fase 5/6.
- D046: navegação mobile com 4 destinos + "Mais" (Reuniões, Projetos, Clientes, Sair), por haver mais de 5 áreas; botão central "Criar" do UI_UX_SPEC não implementado.

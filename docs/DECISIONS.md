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

## Decisões da Fase 5 — lembretes, notificações e Dashboard (2026-10-13)
- D047 (desvio controlado de `reminders` do DATABASE_SPEC): lembrete de **tarefa** usa `remind_at` absoluto; lembrete de **evento** usa `offset_minutes` (0–10080) aplicado a **cada ocorrência**, inclusive de séries recorrentes. CHECKs: `num_nonnulls(task_id, event_id) = 1` e o par (tarefa+`remind_at`) XOR (evento+`offset_minutes`). Colunas extras: `user_id` (destinatário), `status` (`active|cancelled`), `updated_at`.
- D048: `reminders.user_id` vem de `auth.uid()` (default), é imutável para o cliente e filtra a leitura (lembrete é pessoal); escrita só de `owner` ativo (D018). `remind_at` não pode ficar no passado (tolerância de 1 min). Sem duplicatas ativas idênticas (índices únicos parciais). Cliente pode remover lembretes; as notificações já geradas permanecem (`reminder_id` vira nulo).
- D049: worker = `private.process_due_reminders(p_now)` agendado no **pg_cron a cada minuto** (job `process-due-reminders`). SECURITY DEFINER, sem credenciais nem Edge Function. Reaproveita `list_calendar_occurrences` (D041) para expandir ocorrências. Só notifica membro **ativo**, tarefa `todo|in_progress` e evento `scheduled`; janela de recuperação de 24 h (atraso do scheduler ainda dispara, lembrete antigo não); ocorrência já encerrada não dispara.
- D050: idempotência por índice único `(reminder_id, occurrence_at)` em `notifications` + `ON CONFLICT DO NOTHING`; `occurrence_at` = `remind_at` (tarefa) ou início da ocorrência (evento). Reexecutar o worker não duplica; fuso e horário de verão testados (`America/New_York`, 03/11/2030).
- D051: `notifications` só tem SELECT e UPDATE de `read_at` para o dono (sem INSERT/DELETE do cliente). `notification_deliveries` fica sem acesso pela API (telemetria do worker); único canal do MVP é `in_app` (push/WhatsApp seguem em D011).
- D052: Dashboard (`/app`, "Central do dia") lê as entidades de origem (tarefas vencidas e a vencer, `task_plans` de hoje, ocorrências da agenda de hoje, projetos ativos, notificações não lidas) sem cópias; as chaves de cache ficam sob `['tasks']`, `['plans']`, `['calendar']` e `['notifications']`, então concluir uma tarefa em qualquer tela invalida todas. "Hoje" usa o fuso do navegador (D045).
- D053: contador de não lidas por polling (60 s + foco da janela), sem Realtime; rota `/app/notificacoes` e item de menu com contador (no mobile, dentro de "Mais" com indicador). Lembretes de reunião são editados na tela do evento (`/app/agenda/:id`).
- Pendências: `user_preferences` (fuso/tema) e `activity_logs` (migração 008) seguem para a Fase 6; o worker expande todas as séries da janela de 8 dias a cada minuto — suficiente para uso pessoal, revisar se o volume crescer; desabilitar `pg_cron` não é necessário, mas confirmar a extensão habilitada no projeto hospedado antes do deploy.

## Decisões da Fase 6 — preferências, auditoria e fuso (2026-10-13)
- D054: `user_preferences` guarda **somente** `timezone` (validado por trigger: nome IANA). `locale` fica fixo em pt-BR, tema escuro não foi decidido e `dashboard_layout` não tem uso (D008). Pessoal: cada usuário só lê/grava a própria linha; sem DELETE; `user_id` imutável (grant só em `timezone`).
- D055: `activity_logs` é gravado por trigger `SECURITY DEFINER` (`private.log_activity`) em `tasks`, `projects`, `clients` e `calendar_events`; o cliente só tem SELECT (membros ativos da organização). Ações: `created`, `updated`, `status_changed`, `archived`, `unarchived`. `changes` guarda só as colunas alteradas (`{from,to}`); texto longo (`description`, `notes`) registra apenas `{"changed": true}`. Ruído ignorado: `updated_at`, `completed_at`, `created_at`; `work_block` não entra; UPDATE sem diferença não gera linha. Sem backfill: o histórico começa na migração.
- D056 (fecha a pendência do D045): o **fuso de trabalho** (preferência ou, na falta dela, o do navegador) define "hoje", janelas de consulta (agenda/dashboard), a hora de parede digitada nos formulários, o `timezone` de novos eventos e a exibição de datas/horas. Implementação: estado de módulo em `src/lib/format.ts` + `TimezoneBoundary` (define o fuso antes de renderizar e remonta a árvore ao trocar). Eventos já criados mantêm o próprio `timezone`.
- D057: tela `/app/configuracoes` (fuso). O worker de lembretes não depende do fuso do usuário (usa instantes e o fuso do evento).
- Pendência: `supabase db reset` do zero foi bloqueado pelo classificador de permissões do Claude Code nesta sessão; a verificação "banco recriado por migrações" fica para o CI ou para o usuário executar `npm run db:reset`.
- D058 (Fase 6.2, acessibilidade): contraste AA corrigido por token — `--muted-foreground` #64748b → #5f6e84 (4,34 → 4,73:1 sobre `--muted`), `--destructive` #ef4444 → #dc2626 (texto de erro 3,76 → 4,83:1) e novo `--primary-strong` #1d4ed8 para texto sobre tint do azul (nav ativa e badge info; 4,31–4,49 → 5,6–5,8:1). DESIGN.md e sidecar atualizados.
- D059: navegação SPA acessível — skip link, `<main id="conteudo" tabIndex=-1>`, foco movido ao conteúdo só em navegação interna (não no carregamento inicial), `document.title` acompanha o `<h1>`, `errorElement` global (`RouteError`), banner de offline (`role="status"`) e Esc fecha o menu "Mais". Botões/ícones/checkboxes com 44px abaixo de 1024px (`max-lg:`), 36/32px no desktop; `prefers-reduced-motion` respeitado.
- D060 (Fase 6.3, E2E): Playwright 1.64 (Chromium) + `@axe-core/playwright` como devDependencies (D014 já reservava o Playwright para esta fase). Projetos `desktop` e `mobile` (Pixel 7); fuso do navegador fixado em America/Sao_Paulo. Cada spec cria os próprios usuários pela API de Auth (sem depender do seed). Cobertura: autenticação, fluxo diário (cliente → projeto → tarefa → concluir refletido em Início/Meu dia/Tarefas), isolamento entre usuários pela UI, lembrete real via `pg_cron` até a notificação, fluxo mobile (sem rolagem horizontal e alvos ≥ 44 px) e varredura axe WCAG 2.2 AA em 18 telas nos dois viewports. Job `e2e` no CI. Comando: `npm run test:e2e`.
- Observação: o checkbox de conclusão é controlado e só muda após a resposta do servidor (sem atualização otimista); em rede lenta o clique parece não ter efeito por instantes. Candidato a melhoria futura (UI otimista com rollback), fora do escopo da Fase 6.
- D061 (Fase 6.4, segurança): `REVOKE` das 3 funções de trigger que herdavam EXECUTE de PUBLIC e default privileges de `public` revogados para `anon`/`authenticated` (tabelas, sequências, funções novas nascem sem acesso; cada migração concede o mínimo). Invariantes de segurança em pgTAP (`007`) passam a bloquear regressões. Relatório em `docs/SECURITY_REVIEW.md`.
- D062: CSP estrita e cabeçalhos em `config/security-headers.ts` (fonte única, aplicada ao `vite preview` e verificada no E2E; replicar no host). `z.config({ jitless: true })` para dispensar `unsafe-eval`. Sem `unsafe-inline` em scripts nem estilos.
- D063: `check:bundle` (falha o CI se houver segredo privilegiado no `dist/`) e `audit:prod` (`npm audit --omit=dev --audit-level=high`) entram no job `check`.
- D064: configuração local alinhada à produção pretendida: GraphQL fora de `[api].schemas`, senha mínima de 12 com maiúscula/minúscula/dígito. `enable_signup` continua `true` apenas no ambiente local (testes criam usuários); em produção fica `false` (D024).
- D065 (Fase 6.5, backup): backup lógico por `pg_dump` (`data.dump` custom de `public.*` + `auth.users/identities`, `schema.sql` de referência, `counts.tsv`, `SHA256SUMS`); o esquema é reconstruído pelas migrações. `db-restore-check.sh` restaura num banco descartável e verifica checksums, contagens, FKs, RLS e acesso como `authenticated`. RPO 24 h / RTO 1 h propostos (a confirmar). Passos do projeto hospedado e PITR ficam *a validar* no primeiro ensaio em produção (docs/RUNBOOK.md).

## Decisões — vínculos e correção de selects (2026-10-13)
- D066: detalhe do **projeto** lista suas tarefas abertas (10 de prazo mais próximo + total, captura rápida já vinculada, "Ver todas" → `/app/tarefas?projeto=<id>`) e suas reuniões/eventos (próximos e anteriores, recorrentes contam como próximos; "Nova reunião/Novo evento" pré-seleciona projeto e cliente). O detalhe do **cliente** mostra o que está ligado ao cliente **ou a qualquer projeto dele** (`client_id.eq OR project_id.in`), com captura rápida que cria tarefa com `client_id`. Blocos de foco e eventos cancelados ficam fora.
- D067 (bug corrigido): em formulários com selects de projeto/cliente (projeto, tarefa, evento), a opção provisória do valor atual era removida quando a lista chegava e o navegador voltava para "Sem …", deixando a tela enganosa e arriscando desvincular ao salvar. `withCurrentOption` mantém a opção do valor atual com a mesma `key` antes, durante e depois do carregamento; teste de regressão E2E `linked-selects.e2e.ts` (verificado: reprova sem a correção).

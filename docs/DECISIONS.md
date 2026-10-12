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

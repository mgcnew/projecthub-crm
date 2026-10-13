# ProjectHub CRM — Pacote de desenvolvimento v1.0

Este pacote é a fonte de verdade inicial para implementar o MVP em Claude Code ou Codex.

## Decisão sobre o Supabase
O banco é **especificado antes de implementar** e **materializado incrementalmente por migrações SQL** durante o desenvolvimento. Nunca criar tabelas manualmente no dashboard como fonte primária, nem deixar o agente inventar o esquema sem revisar `docs/DATABASE_SPEC.md`.

## Ordem de leitura
1. `docs/PROJECT_MASTER.md`
2. `docs/DECISIONS.md`
3. `docs/DATABASE_SPEC.md`
4. `docs/UI_UX_SPEC.md`
5. `docs/IMPLEMENTATION_PLAN.md`
6. `AGENTS.md` (também aplicável ao Codex) ou `CLAUDE.md`

## Primeira execução
- Criar repositório Git e aplicação React + TypeScript + Vite.
- Configurar Supabase CLI e ambiente local; não usar credenciais reais em commits.
- Implementar somente a **Fase 0** do plano (`docs/IMPLEMENTATION_PLAN.md`), validar e registrar decisões.
- A pasta `supabase/migrations` começa vazia de propósito: migrações serão geradas por fase, revisadas e testadas.

## Desenvolvimento
```bash
npm install
cp .env.example .env.local   # preencher com valores do Supabase local
npm run dev                  # servidor Vite
npm run lint && npm run typecheck && npm test && npm run build
npx supabase start           # requer Docker ou Podman
npm run db:reset             # recria o banco por migrações + seed
npm run db:test              # pgTAP
npm run test:integration     # JWT reais contra o Supabase local
npm run test:e2e             # Playwright (desktop + mobile + axe); requer `npx playwright install chromium`
```

Usuário de desenvolvimento local: ver `supabase/seed.sql`.

## Status
**Fases 0 a 5 concluídas** (tooling; identidade e RLS; clientes e projetos; tarefas e checklists; agenda, reuniões e recorrência mínima; lembretes com worker `pg_cron`, notificações internas e Dashboard). **Fase 6 em andamento**: preferências (fuso), histórico de atividades, acessibilidade e testes E2E concluídos; faltam revisão RLS, backup e deploy.

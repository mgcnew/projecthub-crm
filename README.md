# ProjectHub CRM

Central pessoal de projetos, clientes, tarefas, agenda e reuniões, multitenant desde o banco
(React + TypeScript + Vite no front; Supabase Auth/Postgres/RLS no back).

## Decisão sobre o Supabase
O esquema é **materializado por migrações SQL versionadas** (`supabase/migrations`, 17 até aqui), nunca por
alterações manuais no painel. O banco é especificado em `docs/DATABASE_SPEC.md` (veja ali a seção "Estado
implementado" com os desvios).

## Ordem de leitura
1. `docs/PROJECT_MASTER.md`
2. `docs/DECISIONS.md`
3. `docs/DATABASE_SPEC.md`
4. `docs/UI_UX_SPEC.md`
5. `docs/IMPLEMENTATION_PLAN.md`
6. `AGENTS.md` (também aplicável ao Codex) ou `CLAUDE.md`
7. `docs/SECURITY_REVIEW.md`, `docs/RUNBOOK.md` e `docs/DEPLOY.md` (operação)

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
npm run db:backup            # backup lógico em backups/ (fora do Git); npm run db:restore-check verifica a restauração
npm run deploy:config        # regenera o vercel.json (docs/DEPLOY.md)
npm run check:bundle         # falha se o dist/ tiver segredo privilegiado (rode após build)
npm run test:e2e             # Playwright (desktop + mobile + CSP + axe); requer `npx playwright install chromium`
```

Usuário de desenvolvimento local: ver `supabase/seed.sql`.
Publicação (Vercel + Supabase hospedado): ver `docs/DEPLOY.md`.

## Status
**Fases 0 a 6 concluídas, exceto a publicação do front (Vercel, adiada).** Entregue: autenticação com
verificação em duas etapas (TOTP, imposta no banco) e recuperação de senha; clientes e projetos; tarefas,
subtarefas, checklists e modelos; agenda, reuniões e recorrência mínima; lembretes com worker `pg_cron` e
notificações internas; Central do dia com atividade recente; fuso de trabalho; busca global (Ctrl/Cmd+K); diretório de acessos (sem senhas); financeiro por projeto e relacionamento com o cliente (contatos, interações, documentos);
redesenho "Linhas do Metrô"; registros em painel lateral no desktop e página inteira no celular.

Operação: repositório privado no GitHub com CI verde; banco hospedado com as migrações aplicadas e conferidas
por hash contra o local. Pendências e riscos conhecidos: `docs/IMPLEMENTATION_PLAN.md` (Status),
`docs/DECISIONS.md` (D009–D011) e `docs/SECURITY_REVIEW.md`.

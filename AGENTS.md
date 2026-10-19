# Instruções para agentes de desenvolvimento — ProjectHub CRM

Leia antes de modificar código: `docs/PROJECT_MASTER.md`, `docs/DECISIONS.md`, `docs/DATABASE_SPEC.md`, `docs/UI_UX_SPEC.md`, `docs/IMPLEMENTATION_PLAN.md`.

1. Trabalhe somente na fase solicitada; não gere o SaaS inteiro de uma vez.
2. Apresente plano e arquivos a alterar; aponte dúvidas de arquitetura antes de assumir.
3. O esquema é implementado via migrações Supabase versionadas e revisadas, nunca por alterações manuais não registradas.
4. Toda tabela exposta exige RLS, grants seguros e testes com tenants distintos.
5. FKs multitenant compostas; jamais confiar em `organization_id` fornecido pelo cliente sem autorização.
6. Nunca incluir service_role, tokens, senhas ou `.env` em commits/client bundle.
7. Não inventar endpoints, colunas, bibliotecas ou telas fora do escopo aprovado.
8. Criar componentes reutilizáveis e tratar estados de erro/loading/empty/mobile.
9. Rodar testes, lint e build quando disponíveis; relatar o que não foi executado.
10. Atualizar `docs/DECISIONS.md` e demais docs sempre que o comportamento mudar.
11. Antes de migração destrutiva ou mudança de RLS, parar e solicitar revisão.
12. Não afirmar que algo foi testado sem apresentar comando e resultado.

## Mais de um agente (Claude Code e Codex)
13. Trabalhe em uma branch própria (`feat/<etapa>-<nome>`) e abra pull request; nunca envie direto para a `main`. O CI precisa estar verde antes do merge.
14. Antes de começar, atualize a branch (`git pull`) e confira se não há PR aberto mexendo nos mesmos arquivos.
15. Nunca edite uma migração já aplicada; crie outra. Gere os tipos (`npm run db:types`) após migrar.

## Fase 7 (prospecção e envio) — `docs/PROSPECCAO_PLAN.md`
16. Chaves de Resend, Evolution e DeepSeek ficam só como segredos das Edge Functions; nunca no front, no `.env` versionado ou em logs.
17. Nada é enviado sem aprovação; supressão (`suppression_list`, `opted_out_at`) é verificada no banco e no envio.
18. WhatsApp só para leads morno ou quente, imposto no banco (D105).
19. Testes nunca falam com serviços reais: use os provedores `fake`.
20. Corpo, assunto e endereços de mensagens não entram em `activity_logs` nem na busca global.


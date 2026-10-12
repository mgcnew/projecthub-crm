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

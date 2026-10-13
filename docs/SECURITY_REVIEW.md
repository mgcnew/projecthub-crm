# Revisão de segurança — Fase 6.4 (2026-10-13)

Escopo: esquema do banco (RLS, grants, funções), superfície da API do Supabase, bundle e cabeçalhos do front,
dependências. **Ambiente revisado: Supabase local.** O projeto hospedado ainda não existe; os itens da seção
"Antes de publicar" dependem dele e não foram verificados.

## Método

1. Inspeção do catálogo (`pg_class`, `pg_policies`, `pg_proc`, `information_schema.*_grants`, `pg_default_acl`,
   publicações Realtime, buckets).
2. Invariantes automatizados em `supabase/tests/database/007_security_invariants.test.sql` (16 asserts) — falham se
   uma migração futura reabrir algo.
3. Testes de isolamento por tenant já existentes (pgTAP 001–006, integração com JWT real, E2E com dois usuários).
4. Build de produção sob CSP estrita (`tests/e2e/csp.e2e.ts`), varredura de segredos (`scripts/check-bundle-secrets.mjs`)
   e `npm audit`.

## Resultado

| Controle | Evidência |
|---|---|
| RLS habilitada em todas as 19 tabelas de `public`; nenhuma view | invariantes 1–2 |
| `anon` sem privilégio em tabelas, sequências, funções e sem USAGE em `private` | invariantes 3 |
| `authenticated` sem INSERT/UPDATE em nível de tabela (só por coluna), sem TRUNCATE/REFERENCES/TRIGGER | invariante 4 |
| DELETE do cliente só em `checklist_items`, `checklist_template_items`, `checklist_templates`, `reminders`, `task_plans` (D026/D037/D044/D048) | invariante 5 |
| `id`, `organization_id`, `user_id`, `created_by`, `author_id`, `actor_id` imutáveis para o cliente | invariante 6 |
| Políticas só para `authenticated`, nenhuma com `true` literal | invariantes 7 |
| Nenhuma `SECURITY DEFINER` em `public`; todas as de `private` com `search_path` fixo | invariantes 8 |
| `authenticated` executa apenas `is_active_member`, `is_active_owner` e `list_calendar_occurrences` | invariante 9 |
| FKs entre tabelas de tenant são compostas com `organization_id` | invariante 10 |
| Realtime sem tabelas publicadas; Storage sem buckets | invariante 11 |
| Bundle sem chaves privilegiadas (sb_secret, JWT com role ≠ anon/authenticated, chave privada, URL Postgres) | `npm run check:bundle` |
| 0 vulnerabilidades (`npm audit`, produção e total) | `npm run audit:prod` |
| App funcional sob CSP sem `unsafe-inline`/`unsafe-eval`, `frame-ancestors 'none'` | `csp.e2e.ts` |

## Achados e correções

| # | Achado | Gravidade | Correção |
|---|---|---|---|
| 1 | `private.checklist_items_completion`, `prevent_task_cycles` e `tasks_completion` executáveis por `anon`/`authenticated` (herdavam EXECUTE de PUBLIC). Não chamáveis pela API (`private` não é exposto; são funções de trigger), mas contrariavam o princípio do menor privilégio | Baixa | `REVOKE` na migração `20261013140000_security_hardening.sql` |
| 2 | Default privileges do Supabase concediam ALL a `anon`/`authenticated` em toda tabela/sequência/função nova em `public`; só o `REVOKE` manual de cada migração protegia | Média (risco futuro) | `ALTER DEFAULT PRIVILEGES … REVOKE` na mesma migração + invariantes 3–4 e 9 |
| 3 | O build de produção sondava `new Function("")` (Zod 4), o que uma CSP estrita registra como violação `script-src eval` | Baixa | `z.config({ jitless: true })` em `src/lib/zod-config.ts`, primeiro import de `main.tsx` |
| 4 | GraphQL (`graphql_public`) exposto sem uso | Baixa | removido de `[api].schemas` no `config.toml`; replicar no projeto hospedado |
| 5 | Política de senha local: mínimo 8, sem requisitos | Baixa | `config.toml`: mínimo 12, `lower_upper_letters_digits` |

Nenhuma política de RLS foi relaxada e nenhum dado foi alterado (critério de parada do AGENTS.md respeitado).

## Riscos residuais e decisões em aberto

- **Sem atualização otimista nem limites de taxa próprios:** o rate limit é o do Auth/PostgREST do Supabase; não há
  proteção específica contra abuso de escrita por um owner autenticado (usuário único no MVP).
- **`list_calendar_occurrences` e o worker** expandem séries sob demanda; janela máxima de 93 dias e série limitada a
  3660 dias contêm o custo (D041), mas não há teste de carga.
- **Perfis de co-membros** continuam invisíveis (D023): a trilha de atividade mostra "Outro membro".
- **Diretório de acessos (D086):** guarda URL e usuário (dado pessoal, não segredo), sem senha por desenho; o conteúdo **não é criptografado** e entra no backup. Risco residual: o usuário colar uma senha em "Observações" (a tela avisa, mas não há como detectar). Cofre criptografado fica como etapa futura.
- **MFA (D082–D084):** TOTP disponível em Configurações e **imposto no banco** quando ativado (política restritiva `mfa_required` + aal2). Residual: sem códigos de recuperação (perda do aplicativo exige remoção do fator pelo administrador, ver RUNBOOK) e sem limite de tentativas próprio além do rate limit do Auth.
- **Não coberto:** pentest externo, testes de carga/DoS, revisão de Edge Functions (não há), integração com
  provedores externos (não há), cadeia de suprimentos além do `npm audit`.

## Antes de publicar (depende do projeto hospedado; ver docs/DEPLOY.md)

1. Desabilitar o cadastro público (`enable_signup = false`; D024) e criar o usuário manualmente.
2. Aplicar no projeto: senha ≥ 12 com maiúscula/minúscula/dígito, confirmação de e-mail, SMTP próprio, expiração de
   JWT, rotação de refresh token (já ativa) e `site_url`/redirects exatos do domínio.
3. Remover `graphql_public` dos schemas expostos e confirmar `pg_cron` habilitado (worker de lembretes).
4. Rodar `supabase db lint` e os advisors do projeto (`get_advisors`: segurança e performance) após o `db push`.
5. Configurar no host os cabeçalhos de `config/security-headers.ts`, com o `connect-src` do projeto Supabase.
6. Nunca expor `service_role`/`sb_secret_*` no front; o CI falha se aparecerem no bundle.
7. Conferir backups/PITR do plano contratado e executar o ensaio de restauração (docs/RUNBOOK.md, etapa 6.5).

## Como repetir

```bash
npm run db:test          # pgTAP, inclui os invariantes
npm run test:integration # JWT reais
npm run build && npm run check:bundle && npm run audit:prod
npm run test:e2e         # inclui a CSP sobre o build de produção
```

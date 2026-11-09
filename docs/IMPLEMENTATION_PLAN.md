# Plano de implementação por fases

## Método de trabalho
Uma fase por vez. O agente deve: (1) ler documentos; (2) apresentar plano curto e arquivos afetados; (3) implementar; (4) rodar migrações/testes/lint/build; (5) mostrar evidências; (6) atualizar decisões. Nunca declarar pronto sem executar testes.

### Fase 0 — Repositório e tooling
React + TS + Vite, Tailwind, shadcn/ui, roteamento, TanStack Query, formulários com Zod, Supabase CLI, env.example, Git, CI básico. Critério: app inicial compila e ambiente local sobe.

### Fase 1 — Auth, organização e RLS
Migrações de identidade, provisionamento idempotente, helpers privados, políticas, testes com dois usuários/duas organizações. Critério: isolamento comprovado; nenhum usuário pode elevar privilégios.

### Fase 2 — Clientes e projetos
CRUD real, arquivamento, histórico, vínculos e RLS. Critério: projeto com/sem cliente, isolamento e FK composta testados.

### Fase 3 — Tarefas e checklists
Captura rápida, edição, prazo, prioridade, planejamento diário, subtarefas, modelos. Critério: mover planejamento não altera prazo; checklists copiados não mudam retroativamente.

### Fase 4 — Agenda e reuniões
Eventos, work blocks, reuniões, recorrência mínima definida e testes de fusos. Critério: múltiplos blocos por tarefa, eventos sem inconsistências.

### Fase 5 — Lembretes e Dashboard
Worker confiável, notificações internas, Dashboard com dados reais, ações sincronizadas. Critério: sem disparos duplicados; conclusão aparece em todas as telas.

### Fase 6 — Mobile e publicação
Responsividade, acessibilidade, Playwright, revisão RLS, backup/restauração e deploy. Critério: testes passam, fluxo mobile completo e ambiente de produção protegido.

### Fase 7 — Prospecção e envio (aprovada em 2026-10-19)
Leads com temperatura e funil, importação CSV, catálogo de sistemas, modelos com variação, fila com aprovação, e-mail (Resend), WhatsApp (Evolution, só morno/quente), respostas, conversão em cliente e métricas. Plano detalhado e etapas 7.0–7.10 em `docs/PROSPECCAO_PLAN.md`. Critério: nada é enviado sem aprovação; supressão respeitada em todos os canais; nenhuma chave fora das Edge Functions; testes sem falar com serviços reais.

### Fase 8 — Cofre de senhas (aprovada em 2026-11-07)
Cofre com criptografia no navegador para as senhas dos acessos, tentativas contadas no banco com destruição, backup criptografado exportável. Desenho, limites e etapas em `docs/COFRE_PLAN.md`. Critério: o servidor nunca vê senha em texto; testes cobrem tentativas, bloqueio, destruição, troca de senha mestra, backup e restauração.

## Critérios de parada
Parar e pedir revisão se houver: mudança de modelo de tenancy, relaxamento de RLS, nova integração com credenciais, exclusão destrutiva, migração não reversível, biblioteca de alto impacto ou desvio significativo do escopo.

## Status (2026-10-13)
| Fase | Situação |
|---|---|
| 0 Repositório e tooling | Concluída; CI no GitHub verde (`check`, `database`, `e2e`) |
| 1 Auth, organização e RLS | Concluída; MFA (TOTP) imposta no banco (D082) |
| 2 Clientes e projetos | Concluída; regra definitiva de exclusão em aberto (D010) |
| 3 Tarefas e checklists | Concluída, inclusive modelos de checklist |
| 4 Agenda e reuniões | Concluída com recorrência mínima, sem exceções por ocorrência (D009, D040) |
| 5 Lembretes e Dashboard | Concluída; worker `pg_cron` sem disparo duplicado |
| 6 Mobile e publicação | Concluída exceto o deploy do front (Vercel); banco hospedado com as 11 migrações aplicadas (D081) |

Pendências sem relação com a Vercel: ensaio real de backup/restauração contra o banco hospedado (RUNBOOK),
política de senha/SMTP/Redirect URLs no painel do Supabase e ativação do MFA na conta.
| 8 Cofre de senhas | 8.1 e 8.2 implementadas na branch `feat/cofre` (migração `20261107100000_vault`, pgTAP 015, E2E `vault`); hospedado só depois do merge |
| 7 Prospecção e envio | Aprovada; 7.0, 7.1 (leads e supressão), 7.2 (importação) e 7.3 (sistemas e modelos) e 7.4 (fila e aprovação) feitas, 7.5–7.10 a implementar (`docs/PROSPECCAO_PLAN.md`) |

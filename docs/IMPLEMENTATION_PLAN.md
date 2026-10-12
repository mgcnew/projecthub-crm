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

## Critérios de parada
Parar e pedir revisão se houver: mudança de modelo de tenancy, relaxamento de RLS, nova integração com credenciais, exclusão destrutiva, migração não reversível, biblioteca de alto impacto ou desvio significativo do escopo.

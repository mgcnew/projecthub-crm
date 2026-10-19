# ProjectHub CRM — Documento Mestre v1.0

## Visão
Central pessoal de gestão de projetos, clientes, compromissos, tarefas, reuniões e conhecimento técnico, projetada desde o início para expansão multitenant/SaaS.

## Decisões consolidadas v0.1–v0.5
- **v0.1:** produto pessoal, módulos extensíveis, projetos/clientes/prospecção/recursos/conhecimento.
- **v0.2:** dashboard equilibrado como Central do Dia; vínculos entre tarefas, projetos, clientes e reuniões.
- **v0.3:** tarefas híbridas: prazo ≠ planejamento diário ≠ bloco de horário; lembretes independentes; recorrência; mobile.
- **v0.4:** interface de gestão avançada, densa no desktop, simplificada no mobile; design system e componentes reutilizáveis.
- **v0.5:** Supabase/Postgres, organizações desde o início, RLS, integridade multitenant, migrações e testes.

## MVP obrigatório
1. Auth e espaço pessoal provisionado de forma segura.
2. Cadastro de clientes e projetos, incluindo projetos sem cliente.
3. Tarefas com prioridades, prazos, subtarefas e checklists.
4. Planejamento diário e blocos de tempo independentes do prazo.
5. Agenda e reuniões vinculadas a projetos/clientes.
6. Recorrência de calendário e lembretes internos confiáveis.
7. Dashboard integrado e histórico básico de atividades.
8. Interface responsiva e permissões testadas.

## Futuro (não criar agora)
Prospecção pelo Google Maps, integrações de calendário, biblioteca avançada, cofre de credenciais criptografado, contabilidade (despesas, impostos, fluxo de caixa), automações, IA ligada por padrão e gestão SaaS de planos/equipes.

## Fase 7 aprovada (2026-10-19, D104)
Prospecção com funil comercial e envio por e-mail (Resend) e WhatsApp (Evolution), conforme `docs/PROSPECCAO_PLAN.md`. Financeiro por projeto (recebíveis) já foi entregue (D093).

## Regras de produto
- Um dado de negócio pertence a uma organização.
- Uma tarefa pode não ter prazo, projeto ou cliente.
- Planejar para um dia não altera prazo; reservar bloco não altera prazo.
- Blocos de trabalho são eventos `work_block` associados a uma tarefa.
- Não criar interfaces vazias para módulos ainda não implementados.
- Evitar dependência de histórico de chat: mudanças precisam atualizar os documentos.

## Critérios gerais de pronto
Fluxos completos com dados reais, testes de isolamento e integridade, tratamento de erro, UX mobile, nenhuma ação visual fictícia, documentação e migrações sincronizadas.

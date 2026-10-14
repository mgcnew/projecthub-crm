# UI/UX — Gestão avançada

## Direção visual
> **Superada em parte** — veja "Estado implementado" no fim deste arquivo e `DESIGN.md`. O texto abaixo é a especificação original.

Light padrão, alta densidade informacional no desktop, leitura e ações rápidas no mobile. Fonte Inter (fallback sistema). Tokens: bg #F8FAFC, surface #FFFFFF, text #0F172A, muted #64748B, primary #2563EB, border #E2E8F0, success #10B981, warning #F59E0B, error #EF4444.

## Layout desktop
Sidebar 240px expandida/64px recolhida, topbar 56px, painel contextual opcional 360–420px. Tabelas 40px compactas/48px confortáveis; filtros, ordenação, paginação e ações em lote.

## Layout mobile
Abaixo de 640px: navegação inferior Início/Agenda/Criar/Tarefas/Menu, cartões em vez de tabelas quando apropriado, formulários em tela cheia, alvos de toque 44–48px. 640–1023px intermediário; >=1024px sidebar; >=1440px múltiplas colunas.

## Mapa de rotas
`/app` dashboard; `/app/meu-dia`; `/app/agenda`; `/app/tarefas`; `/app/tarefas/:id`; `/app/reunioes`; `/app/projetos`; `/app/projetos/:id`; `/app/clientes`; `/app/clientes/:id`; `/app/notificacoes`; `/app/configuracoes`. Módulos futuros só aparecem no menu quando implementados.

## Componentes compartilhados
AppShell, SidebarNav, MobileBottomNav, TopBar, PageHeader, DataTable, FilterBar, EntityDrawer, ConfirmDialog, StatusBadge, PriorityIndicator, DateTimePicker, EntitySelector, QuickCreate, EmptyState, ErrorState, LoadingSkeleton, ActivityTimeline, ChecklistEditor, ReminderEditor, RecurrenceEditor.

## Regras
- Captura rápida pede somente título.
- Formulários longos em página; edição rápida em drawer desktop; mobile em tela cheia.
- Alterações não salvas exigem aviso; salvar mostra feedback e impede duplicações.
- Dashboard lê dados das entidades de origem, não mantém cópias.
- Filtros úteis e persistência de preferências; estados loading/empty/error/permission/offline.
- Acessibilidade WCAG 2.2 AA como referência, teclado, foco e ícones/texto além de cores.
- Busca global inicialmente Postgres e escopo da organização; Cmd/Ctrl+K como melhoria.

## Estado implementado (2026-10-13)
O que a spec original previa e o que existe. Decisões de origem entre parênteses; a fonte de verdade visual é
`DESIGN.md` ("Linhas do Metrô") e a de produto é `PRODUCT.md`.

### Onde o implementado difere da especificação
| Spec original | Implementado |
|---|---|
| Fonte Inter; paleta azul `#2563EB` | Hanken Grotesk auto-hospedada; azul profundo nas ações/navegação (D091), tinta no texto sobre claro, cor de **linha** por projeto, vermelho só para "agora" e atraso (D069–D071) |
| Sidebar 240/64 px recolhível; topbar 56 px | Sidebar desktop recolhível (236/64 px), preferência lembrada no navegador; barra superior de 56 px com sino e contador de não lidas (D088) |
| Painel contextual opcional de 360–420 px | Registros em **painel lateral de ~670 px** com abas, expansível para modal central; abaixo de 1024 px são página inteira (D074, D075) |
| "Formulários longos em página" | No desktop abrem em painel; página inteira só no celular/tablet (D074) |
| Navegação inferior Início/Agenda/Criar/Tarefas/Menu | Início, Meu dia, Agenda, Tarefas e "Mais"; a captura rápida fica na própria lista/tela, sem botão central "Criar" (D046) |
| Tabelas com ações em lote | Filtros, ordenação por coluna e paginação no servidor existem; **ações em lote não** |
| Cmd/Ctrl+K como melhoria | Implementado (D085) |

### Rotas
Além do mapa original: `/login`, `/recuperar-senha`, `/redefinir-senha` (sem sessão); `/app/tarefas/modelos`,
`/app/agenda/novo`, `/app/agenda/:id`, `/app/reunioes/:eventId`, `/app/clientes/novo`, `/app/projetos/novo`,
`/app/acessos`, `/app/acessos/novo` e `/app/acessos/:id` (diretório de acessos, D086).

### Componentes compartilhados: nome na spec → onde está
| Spec | Código |
|---|---|
| AppShell, SidebarNav, MobileBottomNav, TopBar | `src/components/layout/AppShell.tsx` (sidebar, barra superior e navegação inferior no mesmo arquivo) |
| PageHeader, StatusBadge, EmptyState, ErrorState, LoadingSkeleton | `src/components/states.tsx` (`LoadingState`) |
| FilterBar, ConfirmDialog | `src/components/FilterBar.tsx`, `src/components/ConfirmDialog.tsx` |
| EntityDrawer | `src/components/entity/` (`EntityOverlay`, `EntityView`) |
| QuickCreate | `src/features/tasks/QuickCapture.tsx` |
| ActivityTimeline, ChecklistEditor, ReminderEditor | `features/activity`, `features/tasks/TaskChecklist.tsx`, `features/notifications/ReminderEditor.tsx` |
| Busca global | `src/features/search/` |
| Acessos (cópia em 1 clique) | `src/features/access/`, `src/components/CopyButton.tsx` |

Sem componente compartilhado (a função existe, inline em cada tela): `DataTable` (tabelas por feature),
`PriorityIndicator`, `DateTimePicker` (campos nativos `datetime-local`), `EntitySelector` (`<select>` nativos com
`option-list`) e `RecurrenceEditor` (em `EventDetailPage`).

### Regras: situação
| Regra | Situação |
|---|---|
| Captura rápida pede só o título | Atendida |
| Alterações não salvas exigem aviso | Atendida em tarefa, projeto, cliente, evento e reunião; **não** em anotações do projeto, modelos de checklist, fuso e segurança |
| Dashboard lê das entidades de origem | Atendida (D052) |
| Filtros úteis e persistência de preferências | Atendida (filtros e ordenação lembrados nas listas) |
| Estados loading/empty/error/permission/offline | Atendida (leitura somente para quem não escreve; banner offline) |
| WCAG 2.2 AA, teclado, foco | Verificada por axe em desktop e celular (E2E) |

### Autenticação (2026-10-14, D090)
Moldura compartilhada: no desktop, composição centralizada de até 1240px com painel em azul profundo (D091), diagrama neutro e coluna branca para o formulário (até 384px); no celular/tablet, somente marca e formulário em uma coluna. Preserva Hanken Grotesk, cantos de 2px, réguas e foco do sistema. Login oferece mostrar/ocultar senha por botão de 44px, com nome acessível que acompanha o estado. Recuperação, redefinição e segunda etapa usam a mesma moldura; os fluxos existentes permanecem.

Cor primária global (D091): azul profundo #0455A1, hover #034580, texto branco sobre ações e seleção; texto de conteúdo continua #111418.

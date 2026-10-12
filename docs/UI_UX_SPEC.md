# UI/UX — Gestão avançada

## Direção visual
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

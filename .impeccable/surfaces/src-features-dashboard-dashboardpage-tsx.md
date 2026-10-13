---
version: 1
slug: "src-features-dashboard-dashboardpage-tsx"
primary_target: "src/features/dashboard/DashboardPage.tsx"
related_targets: ["src/components/layout/AppShell.tsx","src/features/tasks/MyDayPage.tsx","src/features/tasks/TasksPage.tsx","src/features/calendar/AgendaPage.tsx","src/features/projects/ProjectsPage.tsx","src/features/clients/ClientsPage.tsx"]
---

# Superfície: aplicativo inteiro (shell + Central do dia, Meu dia, Tarefas, Agenda/Reuniões, Clientes/Projetos)

Modo: Operate. Público: autônomo de tecnologia gerindo sozinho clientes, projetos, reuniões e tarefas; desktop denso e celular para consulta rápida. Tema claro preservado (pedido do usuário). Redesenho escolhido pelo usuário em 2026-10-13 (card "Linhas do Metrô").

## Direction contract

THESIS: Projetos e clientes são linhas; o dia é uma linha de estações (os compromissos) onde as linhas se cruzam. Recusa o arranjo padrão da categoria: cartões brancos com indicadores grandes no topo, pílulas coloridas e um acento azul genérico.

OWN-WORLD: Placas esmaltadas da sinalização do Metrô de São Paulo. Fundo #F2F4F5, placas brancas, tinta #111418, réguas #D9DEE2, filete de 2px em tinta sob cabeçalhos de tabela. Cor de linha reservada a projetos (Azul, Verde, Amarela, Lilás, Rubi, Turquesa, Ouro; Prata para "sem projeto"); Vermelho só para "agora" e atraso. Grotesca neo-grotesca (Hanken Grotesk) em pesos firmes, numerais tabulares, rótulos de seção em caixa alta espaçada. Cantos retos (2px), selos de linha circulares com a inicial do projeto, botão primário em tinta sólida.

STORY: Ao abrir, a pessoa lê o dia como um trajeto: onde está agora, qual a próxima estação, que linhas (projetos) passam hoje, o que está planejado e o que vence. Ela marca concluído, planeja, captura e segue para a próxima estação sem trocar de tela.

FIRST VIEWPORT: Rail branco de 236px à esquerda (marca "P" em placa preta, itens de 42-44px, ativo em placa preta com texto branco). Conteúdo: título "Central do dia" (30px, 700) com a data abaixo e ações à direita. Abaixo, a placa "Linha do dia": trilho horizontal de 8px atravessando o dia, segmentos coloridos por projeto, estações circulares com nome acima e hora abaixo, marcador vermelho "agora". Em seguida, duas colunas: tabela "Planejado hoje" (Linha, Tarefa, Prazo, Estimativa, Situação) e placa "Prazos · próximos 7 dias" com faixas de cor de linha. No mobile o trilho vira vertical, como o diagrama dentro do vagão, e a navegação fica embaixo.

FORM: Sinalização do Metrô de São Paulo (Cauduro Martino), 1º da lista ordenada por ressonância (escolhido pelo usuário como IMPECCABLE'S PICK), seed key 42252037. Desvio deliberado do esboço: a cor de linha não marca áreas do menu (risco de arco-íris declarado no próprio card); o menu usa marcador neutro e a cor fica para projetos. Data abaixo do título, não acima (sem kicker).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

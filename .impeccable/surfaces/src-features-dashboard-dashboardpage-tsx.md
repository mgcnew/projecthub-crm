---
version: 1
slug: "src-features-dashboard-dashboardpage-tsx"
primary_target: "src/features/dashboard/DashboardPage.tsx"
related_targets: ["src/components/layout/AppShell.tsx","src/features/tasks/MyDayPage.tsx","src/features/tasks/TasksPage.tsx","src/features/calendar/AgendaPage.tsx","src/features/projects/ProjectsPage.tsx","src/features/clients/ClientsPage.tsx","src/features/leads/LeadsPage.tsx"]
---

# Superfície: aplicativo inteiro (shell + Central do dia, Meu dia, Tarefas, Agenda/Reuniões, Clientes/Projetos, Prospecção)

Modo: Operate. Público: autônomo de tecnologia gerindo sozinho clientes, projetos, reuniões, finanças e prospecção; desktop denso e celular para consulta rápida. Tema claro preservado. Redesenho escolhido pelo usuário em 2026-10-19 (card canon "O padrão da categoria"), substituindo "Linhas do Metrô" (2026-10-13). A UX não muda: rotas, fluxos, textos, atalhos e comportamento ficam iguais; muda a pele.

## Direction contract

THESIS: O painel SaaS que a categoria entrega, executado com acabamento de agência: superfícies brancas com cantos suaves, hierarquia calma, números grandes e honestos, estados com cor e ícone. Convenção abraçada sem ironia; o diferencial é o rigor (alinhamento, ritmo, contraste, estados), não um tema.

OWN-WORLD: Painel SaaS contemporâneo. Fundo #F7F7F8, superfícies #FFFFFF com borda #ECECEF e sombra quase nula; tinta #111827, texto secundário #6B7280. Cantos: 12px em cartões e painéis, 8px em botões, campos e itens de menu, pílula em selos. Primário azul profundo #0455A1 (D091) em ações, marca e item ativo do menu. Estados em pares pastel+tinta: sucesso #E6F6EC/#1A7F45, perigo #FDE8EC/#C9353B, atenção #FFF4D6/#A16207, informação #E7F0FF/#0455A1, roxo #EFEAFE/#6B4FD8, neutro #F3F4F6/#374151. Ícones (lucide) dentro de chips coloridos de 32px nos cartões de número e nos itens de lista quando o tipo importa. Cores de linha dos projetos mantidas como pontos/segmentos (identidade "Metrô" suavizada). Hanken Grotesk, numerais tabulares, títulos de seção em caixa normal (sem caixa alta espaçada).

STORY: Ao abrir, a pessoa vê em quatro números o estado do dia (planejado, vencidas, a receber em 7 dias, contatos a fazer, todos reais), lê a Linha do dia como um trilho suave com o marcador "agora", e trabalha na tabela/listas abaixo sem trocar de tela.

FIRST VIEWPORT: Rail branco de 240px com marca "P" em placa azul de 8px de raio, grupos rotulados (Dia a dia, Negócio, Conta) em rótulo pequeno cinza, itens de 38-40px com raio 8px e ativo em azul sólido com texto branco. Conteúdo: título "Central do dia" (24-28px, 700) com a data abaixo e ações à direita (secundária branca com borda, primária azul). Fileira de 4 cartões de número (rótulo + chip de ícone colorido à direita, número grande, nota cinza). Painel "Linha do dia" com trilho arredondado, segmentos na cor do projeto, estações circulares e marcador "agora" vermelho. Painel "Planejado hoje" com cabeçalho de tabela em fundo #FAFAFB, selos em pílula pastel e ponto de cor do projeto; ao lado ou abaixo, "Prazos · 7 dias". Mobile: navegação inferior, cartões de número em grade 2x2, trilho vertical.

FORM: Canon da categoria (escolha deliberada do usuário, seed:f396ad4dc8b2e3be). Barra de qualidade: a referência Uxferflow enviada pelo usuário, Linear e Attio — densidade, alinhamento e estados nesse nível. Desvios deliberados do esboço: Hanken Grotesk em vez de Inter (já servida pelo app, mais caráter); a Linha do dia permanece (pedido do usuário: manter o Metrô suavizado); números só com dados reais, sem variação inventada; sem seleção em lote nem paginação onde a tela não tem essas funções (UX não muda).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

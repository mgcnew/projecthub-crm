---
name: ProjectHub CRM
description: Central pessoal de trabalho lida como um mapa de metrô; placas esmaltadas em tinta, linhas coloridas por projeto e o vermelho reservado para o agora.
colors:
  background: "#f2f4f5"
  foreground: "#111418"
  card: "#ffffff"
  primary: "#0455a1"
  primary-hover: "#034580"
  primary-foreground: "#ffffff"
  primary-strong: "#0455a1"
  muted: "#e8ecef"
  muted-foreground: "#565e66"
  nav-ink: "#3b4148"
  border: "#d9dee2"
  input: "#848e96"
  track: "#d3d9de"
  destructive: "#b4141b"
  now: "#ee372f"
  line-azul: "#0455a1"
  line-verde: "#007e5e"
  line-amarela: "#ffd400"
  line-lilas: "#9b3894"
  line-rubi: "#ca016b"
  line-turquesa: "#047fa3"
  line-ouro: "#946616"
  line-prata: "#68717a"
typography:
  headline:
    fontFamily: "Hanken Grotesk Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.02em"
    fontFeature: "'tnum' 1"
  title:
    fontFamily: "Hanken Grotesk Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 700
    lineHeight: "1.25rem"
    letterSpacing: "0.1em"
    fontFeature: "'tnum' 1"
  body:
    fontFamily: "Hanken Grotesk Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: "1.25rem"
    fontFeature: "'tnum' 1"
  body-strong:
    fontFamily: "Hanken Grotesk Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: "1.25rem"
    fontFeature: "'tnum' 1"
  panel-title:
    fontFamily: "Hanken Grotesk Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: "1.2"
    letterSpacing: "-0.02em"
  lead:
    fontFamily: "Hanken Grotesk Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: "1.5rem"
    fontFeature: "'tnum' 1"
  label:
    fontFamily: "Hanken Grotesk Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: "1rem"
    fontFeature: "'tnum' 1"
rounded:
  sm: "2px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
    height: "36px"
  button-outline:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
    height: "36px"
  button-outline-hover:
    backgroundColor: "{colors.muted}"
  button-destructive:
    backgroundColor: "{colors.destructive}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
    height: "36px"
  button-link:
    textColor: "{colors.primary-strong}"
    typography: "{typography.body-strong}"
  input:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "44px"
  nav-link:
    textColor: "{colors.nav-ink}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "44px"
  nav-link-active:
    backgroundColor: "{colors.foreground}"
    textColor: "{colors.card}"
    rounded: "{rounded.sm}"
  plate:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.sm}"
    padding: "12px 20px 16px"
  line-badge:
    backgroundColor: "{colors.line-azul}"
    textColor: "{colors.primary-foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    size: "24px"
  status-neutral:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
  status-info:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
  status-success:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.muted-foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
  status-danger:
    backgroundColor: "{colors.foreground}"
    textColor: "{colors.card}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
---

# Design System: ProjectHub CRM

## Overview

**Creative North Star: "Linhas do Metrô"**

O sistema empresta a sinalização do Metrô de São Paulo: placas esmaltadas brancas sobre um fundo cinza-claro frio, tinta quase preta, réguas finas e selos circulares de linha. Projetos e clientes são linhas; o dia é uma linha de estações (os compromissos) onde essas linhas se cruzam. A pessoa lê o dia como um trajeto: onde está agora, qual é a próxima estação, que linhas passam hoje e o que vence.

A densidade é de painel de operação, não de vitrine: tabelas com números tabulares, placas de seção com título em caixa alta e contagem ao lado, uma única grotesca em pesos firmes. A ênfase vem de peso e preenchimento. Azul profundo identifica ações, seleção e marca; as demais cores pertencem às linhas dos projetos, e o vermelho pertence ao "agora" e ao atraso.

O mundo recusa o arranjo padrão da categoria: cartões brancos com indicadores grandes no topo, pílulas coloridas de status e cor espalhada sem significado. A navegação usa uma única cor primária: azul profundo para o item ativo.

**Key Characteristics:**
- Fundo cinza frio, placas brancas com régua de 1px, azul profundo como cor de ação.
- Sete cores de linha mais a Prata, atribuídas aos projetos; azul profundo também identifica ações e navegação.
- Vermelho só para o marcador "agora" e para atraso.
- Cantos retos (2px) em tudo que é placa; círculos só em selos de linha e estações.
- Filete de 2px em tinta sob cabeçalhos de página e de tabela.
- Uma assinatura: a Linha do dia.

## Colors

Neutros frios de sinalização, azul profundo como primário, tinta para leitura e uma paleta de linhas que funciona como identidade dos projetos, nunca como decoração.

### Primary
- **Tinta de Placa** (foreground): texto, selo de situação "perigo" e filete de cabeçalho.
- **Azul Profundo** (primary): botão principal, navegação ativa, marca, seleção de resultado da busca e painel de autenticação. Branco sobre #0455a1; hover #034580.
- **Azul da Linha 1** (primary-strong): links, anel de foco (3px) e seleção de texto (com 20% de opacidade). 7,45:1 sobre branco.

### Secondary
- **Linhas de projeto** (line-azul, line-verde, line-amarela, line-lilas, line-rubi, line-turquesa, line-ouro): cada projeto recebe uma linha na ordem de criação; a partir do oitavo projeto o ciclo recomeça. Aparecem no selo de linha, na faixa vertical de prazos e nos segmentos e estações da Linha do dia. Texto sobre a linha é branco, exceto na Amarela, que usa tinta; todos com contraste de pelo menos 4,5:1.
- **Prata** (line-prata): a linha de "sem projeto"; o selo mostra um travessão em vez de inicial.

### Tertiary
- **Vermelho Agora** (now): somente o marcador e a estação "agora" da Linha do dia.
- **Vermelho Atraso** (destructive): texto de prazo atrasado, erros, borda do estado de erro e botão destrutivo. 6,87:1 sobre branco.

### Neutral
- **Cinza de Plataforma** (background): fundo da aplicação.
- **Placa Branca** (card): toda superfície de conteúdo, rail lateral, diálogo e barra inferior.
- **Cinza Esmalte** (muted): hover de itens, selo "concluída", esqueletos de carregamento, campo desabilitado.
- **Tinta Secundária** (muted-foreground): metadados, descrições, cabeçalhos de coluna. 6,59:1 sobre branco e 5,54:1 sobre o Cinza Esmalte.
- **Tinta de Menu** (nav-ink): rótulos inativos da navegação.
- **Régua Fina** (border): bordas de placa, divisórias de linhas de tabela.
- **Régua de Campo** (input): borda de campos e da placa tracejada de vazio. 3,34:1, acima do mínimo de 3:1 para componentes.
- **Trilho** (track): o trilho cinza da Linha do dia, sob os segmentos coloridos.

### Named Rules
**The Line Ownership Rule.** Cor de linha pertence a projetos. Cores de linha identificam projetos; o azul profundo também é a cor primária de ações, marca e navegação. As demais cores de projeto não pintam menu, botões ou status.

**The Red Is Now Rule.** Vermelho aparece só no "agora" e no atraso. A paleta de linhas exclui o vermelho de propósito, para que nenhum projeto seja confundido com urgência.

**The Yellow Outline Rule.** A Linha Amarela tem 1,30:1 contra o fundo; todo uso dela (selo, faixa, segmento, estação) leva contorno de 1px em tinta e texto em tinta.

**The Never Color Alone Rule.** O selo de linha sempre traz a inicial do projeto e o nome como rótulo acessível; status sempre têm texto.

## Typography

**Display Font:** Hanken Grotesk Variable (com ui-sans-serif, system-ui)
**Body Font:** Hanken Grotesk Variable
**Label/Mono Font:** a mesma família; números tabulares ligados globalmente (`tnum`).

**Character:** Uma grotesca neo-grotesca auto-hospedada em pesos firmes, como as letras de uma placa de estação: o peso faz a hierarquia, não o tamanho.

### Hierarchy
- **Headline** (700, 30px, 1.25, -0.02em; 28px abaixo de 640px): o título de cada página, com a descrição (data, contexto) logo abaixo, nunca acima.
- **Title** (700, 13px, 20px, 0.1em, caixa alta): título de placa de seção, como o nome de uma estação; a contagem segue ao lado em peso 600, caixa normal, Tinta Secundária.
- **Lead** (400, 15px): descrição sob o título da página, em Tinta Secundária.
- **Body / Body strong** (400 e 600, 14px, 20px): texto de tabela, nomes de estação e de tarefa (600).
- **Label** (600, 12px): cabeçalhos de coluna, selos de situação, horas e tipo de compromisso; marcas de hora do trilho a 11px/500.

### Named Rules
**The Tabular Rule.** Toda hora, data, estimativa e contagem usa numerais tabulares; colunas de número se alinham sem esforço.

**The Weight Not Size Rule.** A hierarquia dentro das placas vem de peso (600/700) e caixa alta espaçada, não de tamanhos maiores. Nada passa de 30px.

## Layout

Desktop (a partir de 1024px): rail branco fixo de 236px à esquerda com borda direita em Régua Fina; conteúdo ocupando a largura útil, com respiro lateral de 24px e largura máxima de 1600px (só em monitores muito largos o conteúdo centraliza). Abaixo de 1024px o rail some e a navegação vira barra inferior fixa. O conteúdo empilha placas com 24px entre elas.

Cada página abre com o cabeçalho: título à esquerda, ações à direita, filete de 2px em tinta embaixo. Placas têm 16px de respiro lateral no celular e 20px a partir de 640px. Na Central do dia, a Linha do dia ocupa a largura toda; abaixo vêm duas colunas (tabela planejada e prazos).

No desktop, **registros** (detalhe de tarefa, projeto, cliente, evento e reunião, e as criações) abrem num painel lateral de 672px por cima da página de origem, que continua visível e inerte atrás; o botão "expandir" o transforma num modal central de até 1056px, e a escolha é lembrada. Abaixo de 1024px a mesma rota é a página inteira. Listas, Central do dia, Meu dia, Agenda, Notificações e Configurações nunca viram painel.

A 768px muda a gramática: a Linha do dia passa de trilho vertical (diagrama de vagão) para horizontal, e a tabela de tarefas troca as colunas por uma linha de metadados sob o título. Filtros recolhem atrás de um botão "Filtros" abaixo de 768px. Alvos de toque têm 44px no celular (botões sobem de 36px para 44px abaixo de 1024px).

## Elevation & Depth

O sistema é plano. Profundidade vem de placas brancas sobre o fundo cinza e de réguas, nunca de sombra em repouso. As duas únicas sombras são de camadas flutuantes que cobrem conteúdo: o diálogo de confirmação e a folha "Mais" da navegação móvel.

### Shadow Vocabulary
- **Diálogo** (`box-shadow: 0 18px 40px -12px rgb(17 20 24 / 0.35)`): diálogo modal de confirmação, sobre véu de tinta a 45%.
- **Folha inferior** (`box-shadow: 0 -12px 32px -12px rgb(17 20 24 / 0.3)`): menu "Mais" acima da barra inferior.

### Named Rules
**The Flat Plate Rule.** Placas, selos, botões e tabelas não têm sombra. Se algo precisa se destacar, use régua de 2px em tinta ou preenchimento sólido.

## Shapes

Cantos retos: todo elemento retangular usa 2px de raio (placas, botões, campos, selos de situação, diálogo, itens de menu). Círculos são reservados a selos de linha (24px; 20px na versão compacta) e estações da Linha do dia (anel de 5px sobre miolo branco). Réguas de 1px separam; o filete de 2px em tinta encerra cabeçalhos de página, de tabela, a barra inferior móvel e o diálogo. A placa vazia usa borda tracejada na Régua de Campo, como um espaço de placa ainda sem sinal. Faixas de linha são retângulos verticais de 6px.

## Components

### Buttons
- **Shape:** retos (2px), 36px de altura no desktop e 44px abaixo de 1024px, texto 14px/600.
- **Primary:** azul profundo com texto branco; hover escurece para `#034580`.
- **Outline:** placa branca com borda de 1px em tinta; hover em Cinza Esmalte. É o par natural do primário ("Novo evento" ao lado de "Planejar o dia").
- **Destructive:** Vermelho Atraso sólido com texto branco, hover `#931016`; só dentro de confirmações.
- **Ghost / Link:** ghost só ganha Cinza Esmalte no hover; link usa o Azul da Linha 1 com sublinhado no hover.
- **Focus:** contorno de 3px no Azul da Linha 1 com 2px de afastamento, igual em todo o sistema.

### Chips (status)
- **Style:** placa retangular pequena (2px, 2px 8px, 12px/600), sempre com texto, nunca colorida.
- **Escala de ênfase:** neutro = régua fina sobre branco ("A fazer"); info = contorno em tinta ("Em andamento"); sucesso = Cinza Esmalte com Tinta Secundária ("Concluída"); atenção = só texto em negrito, sem placa ("Alta"); perigo = placa sólida em tinta ("Urgente").

### Cards / Containers
- **Corner Style:** 2px.
- **Background:** Placa Branca sobre o Cinza de Plataforma.
- **Shadow Strategy:** nenhuma (ver The Flat Plate Rule).
- **Border:** 1px na Régua Fina.
- **Internal Padding:** cabeçalho 12px em cima e 8px embaixo; corpo 16px (celular) ou 20px de lado e 16px embaixo. Título em caixa alta à esquerda, contagem ao lado, ação de texto à direita.
- **Estados:** carregamento é uma placa com barras e círculos pulsantes em Cinza Esmalte; erro é placa com borda em Vermelho Atraso, ícone e "Tentar novamente"; vazio é placa tracejada centralizada que sempre oferece a próxima ação.

### Inputs / Fields
- **Style:** 44px de altura, fundo branco, borda de 1px na Régua de Campo, 2px de raio, texto 16px.
- **Focus:** borda passa ao Azul da Linha 1 com contorno de 3px desse azul a 40%.
- **Error / Disabled:** borda em Vermelho Atraso; desabilitado em Cinza Esmalte a 70%.
- **Select:** nativo com `appearance: base-select`; botão como um campo (44px) e seta que gira ao abrir. A lista é uma placa branca com filete de 2px em tinta, itens de 40px (44px no celular), hover em Cinza Esmalte e o item selecionado em placa de tinta com ✓ (mesma gramática do item ativo do menu). Sem suporte (Firefox, Safari) cai no select do navegador. Sugestões de texto livre usam botões de sugestão, não `<datalist>`.
- **Checkbox:** nativo com `accent-color` em azul profundo.

### Navigation
- **Desktop:** rail branco de 236px; marca "P" em quadrado azul profundo ao lado de "ProjectHub" (17px/700). Itens de 44px com pictograma de 18px e rótulo 14px/600 em Tinta de Menu; hover em Cinza Esmalte; ativo é placa sólida em azul profundo com texto branco. Contagem de não lidas é um selo contornado na cor do texto. "Sair" fica no pé do rail.
- **Mobile:** barra inferior branca com filete de 2px em tinta no topo, cinco colunas (quatro destinos e "Mais"), ícone de 20px sobre rótulo de 12px, 56px de altura; ativo em placa azul profundo. "Mais" abre uma folha com os demais destinos.
- O pictograma acompanha o nome, nunca o substitui.

### Painel de registro
Placa branca fixa à direita, altura da janela, filete de 2px em tinta à esquerda e sombra só no fundo escurecido (45% de tinta). Cabeçalho: tipo do registro em caixa alta espaçada (12px/700), título em 24px/700, selo de situação e ações; abas logo abaixo e conteúdo rolando por baixo do cabeçalho fixo. Fecha com Esc, clique no fundo ou ×; o foco volta ao elemento de origem. Confirmações abrem por cima como diálogo próprio.

### Abas
Faixa de abas com sublinhado de 3px em tinta na ativa e texto 14px/600 (Tinta na ativa, Tinta Secundária nas demais), altura de 44px, rolagem horizontal quando não cabem. Setas, Home e End navegam; a aba ativa vai para a URL (`?aba=`). Cada painel carrega só ao abrir e fica montado depois, então um formulário digitado não se perde ao trocar de aba. Só a aba "Detalhes" tem o botão Salvar; as demais salvam por ação.

### Line Badge
Selo circular na cor da linha do projeto com a inicial em 12px/700 (texto branco ou tinta, conforme a linha). A Prata com travessão marca "sem projeto". A **faixa de linha** (6px, vertical) é a forma em lista do mesmo selo, usada na placa de prazos.

### Task Table
Cabeçalho de colunas em 12px/600 Tinta Secundária sobre filete de 2px em tinta; linhas separadas por Régua Fina. Colunas: concluir, Linha (selo), Tarefa (título 600 com projeto embaixo), Prazo, Estimativa, Situação. Prazo atrasado em Vermelho Atraso 600. Concluídas ficam riscadas em Tinta Secundária. Abaixo de 768px, os metadados (selo, projeto, prazo, estimativa) viram uma linha sob o título.

### Linha do dia (Signature Component)
A assinatura do sistema. Um trilho de 8px em Trilho atravessa o dia; cada compromisso é um segmento na cor da linha do projeto (blocos de foco a 55% de opacidade) com uma estação circular no início. Nome da estação (14px/600) acima ou abaixo do trilho, alternando para não colidir, com "hora · tipo" em 12px. Marcas de hora em 11px embaixo. O "agora" é um traço vertical de 2px em Vermelho Agora com estação vermelha e o rótulo "Agora HH:MM" em Vermelho Atraso. Abaixo de 768px o trilho fica vertical, como o diagrama dentro do vagão: hora à esquerda, estação no trilho, nome à direita. Fecha com a leitura "Próxima estação · HH:MM · título · em 1h12" (e "Em andamento · título até HH:MM" quando houver), separada por régua fina. É uma única lista ordenada acessível; trilho e segmentos são decorativos.

## Do's and Don'ts

### Do:
- **Do** usar azul profundo (#0455a1) para a ação principal e para o item ativo da navegação.
- **Do** dar a cada projeto seu selo de linha, com inicial, sempre que ele aparecer em lista, tabela ou na Linha do dia.
- **Do** contornar a Linha Amarela com 1px de tinta e escrever sobre ela em tinta.
- **Do** encerrar cabeçalhos de página e de tabela com filete de 2px em tinta.
- **Do** expressar status pela escala de ênfase em tinta (régua fina, contorno, negrito, placa sólida), sempre com texto.
- **Do** usar numerais tabulares em horas, datas, estimativas e contagens.
- **Do** colocar a data e o contexto abaixo do título da página.

### Don't:
- **Don't** usar as demais cores de projeto na navegação, em botões ou em status; azul profundo é a exceção aprovada como primário.
- **Don't** usar vermelho fora do "agora" e do atraso, nem incluí-lo na paleta de linhas.
- **Don't** colocar sombra em placas, selos ou botões; sombra só em diálogo e folha flutuante.
- **Don't** arredondar placas, botões ou campos além de 2px; círculos são só para selos e estações.
- **Don't** abrir a página com uma faixa de indicadores grandes em cartões; o topo da Central do dia é a Linha do dia.
- **Don't** pôr rótulos em caixa alta acima do título da página; caixa alta espaçada é só para títulos de placa.

## Autenticação
A moldura de login, recuperação/redefinição e MFA usa uma composição de até 1240px, centralizada sobre Cinza de Plataforma no desktop. Painel em Azul Profundo com marca, mensagem e diagrama de estações neutro; formulário em Placa Branca, com largura máxima de 384px. O diagrama não atribui cores de projeto a decoração. Abaixo de 1024px, marca e formulário ocupam uma coluna branca. Campos mantêm 44px; o botão principal do login tem 48px, e o controle de visibilidade da senha tem alvo de 44px.

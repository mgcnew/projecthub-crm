---
name: ProjectHub CRM
description: Painel SaaS da categoria executado com acabamento de agência; superfícies brancas de cantos suaves, azul profundo para agir e estados em pares pastel + tinta.
colors:
  background: "#f7f7f8"
  foreground: "#111827"
  card: "#ffffff"
  primary: "#0455a1"
  primary-hover: "#034580"
  primary-foreground: "#ffffff"
  muted: "#f3f4f6"
  muted-foreground: "#5f6672"
  border: "#e7e8ec"
  border-strong: "#d4d7de"
  input: "#8b919c"
  table-head: "#fafafb"
  destructive: "#b4141b"
  now: "#ee372f"
  tone-success-bg: "#e6f6ec"
  tone-success: "#17663a"
  tone-danger-bg: "#fdebec"
  tone-danger: "#b4141b"
  tone-warning-bg: "#fff4d6"
  tone-warning: "#8a5300"
  tone-info-bg: "#e7f0ff"
  tone-info: "#0455a1"
  tone-violet-bg: "#efeafe"
  tone-violet: "#5b3fc4"
  tone-neutral-bg: "#f3f4f6"
  tone-neutral: "#374151"
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
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.025em"
    fontFeature: "'tnum' 1"
  stat:
    fontFamily: "Hanken Grotesk Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: "2rem"
    letterSpacing: "-0.02em"
    fontFeature: "'tnum' 1"
  title:
    fontFamily: "Hanken Grotesk Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 700
    lineHeight: "1.375rem"
    letterSpacing: "-0.005em"
  lead:
    fontFamily: "Hanken Grotesk Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
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
  label:
    fontFamily: "Hanken Grotesk Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: "1rem"
rounded:
  option: "6px"
  control: "8px"
  card: "12px"
  floating: "16px"
  pill: "9999px"
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
    rounded: "{rounded.control}"
    padding: "8px 16px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-outline:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.control}"
    padding: "8px 16px"
    height: "36px"
  button-outline-hover:
    backgroundColor: "{colors.muted}"
  button-ghost:
    textColor: "{colors.foreground}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.control}"
    padding: "6px 12px"
    height: "32px"
  button-ghost-hover:
    backgroundColor: "{colors.muted}"
  input:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "36px"
  input-touch:
    height: "44px"
  card:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.card}"
    padding: "16px 20px 20px"
  nav-item:
    textColor: "{colors.tone-neutral}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "40px"
  nav-item-hover:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.foreground}"
  nav-item-active:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
  status-badge-success:
    backgroundColor: "{colors.tone-success-bg}"
    textColor: "{colors.tone-success}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "2px 10px"
  status-badge-info:
    backgroundColor: "{colors.tone-info-bg}"
    textColor: "{colors.tone-info}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "2px 10px"
  icon-chip:
    rounded: "10px"
    size: "36px"
  table-head:
    backgroundColor: "{colors.table-head}"
    textColor: "{colors.muted-foreground}"
    typography: "{typography.label}"
---

# Design System: ProjectHub CRM

## Overview

**Creative North Star: "O Padrão da Categoria, com Acabamento de Agência"**

O sistema abraça, sem ironia, o painel SaaS que a categoria entrega (a régua de qualidade é Linear, Attio e a referência Uxferflow do usuário): fundo cinza-gelo, superfícies brancas de cantos suaves, tinta grafite, um azul profundo para agir e estados nomeados por pares pastel + tinta. O diferencial não é um tema; é o rigor: alinhamento, ritmo de 4px, contraste AA conferido, alvos de toque de 44px e estados sempre escritos por extenso.

A densidade é de ferramenta de trabalho, não de vitrine. Números grandes só onde há números reais (os quatro cartões do dia), tabelas com numerais tabulares e cabeçalho em cinza quase branco, cartões com cabeçalho dividido por régua fina. A identidade anterior ("Linhas do Metrô") sobrevive suavizada em um único lugar com dono: as cores de linha identificam projetos (selo circular com inicial, faixa, segmento) e a Linha do dia continua sendo um trilho arredondado com estações e o marcador vermelho do "agora".

Tema claro apenas. A política de segurança de conteúdo é estrita (sem script ou estilo inline no HTML; imagens e máscaras `data:` permitidas), então ícones desenhados em CSS entram como máscara SVG em `data:` e tudo o mais vem de folhas e classes.

**Key Characteristics:**
- Fundo cinza-gelo, cartões brancos com borda fria de 1px, canto de 12px e sombra de contato quase invisível.
- Azul profundo sólido para ação primária, item ativo do menu, opção selecionada e marca; nada mais é azul sólido.
- Estados em pílulas pastel com ponto e texto; chips de ícone pastel nos cartões de número.
- Cores de linha só para projetos; vermelho vivo só para o "agora".
- Hanken Grotesk em todo lugar, numerais tabulares em todo lugar, títulos em caixa normal.
- Controles de 36px no desktop e 44px abaixo de 1024px.

## Colors

Neutros frios e quase sem croma carregam a interface; a cor aparece com papel definido: azul para agir, pastéis para estados, linhas para projetos, vermelho para o agora e o atraso.

### Primary
- **Azul Profundo** (`primary`): botão principal, item ativo do menu lateral e da navegação inferior, opção marcada nos selects, marca "P", contador de notificações, foco (`ring`), cursor de texto e checkboxes. Branco sobre ele passa AA. Decisão D091.
- **Azul Profundo Pressionado** (`primary-hover`): hover do botão principal.

### Secondary
- **Pares de estado** (`tone-*-bg` + `tone-*`): sucesso (Menta Pastel + Verde Floresta), perigo (Rosa Pastel + Vermelho Atraso), atenção (Creme Âmbar + Âmbar Queimado), informação (Azul Gelo + Azul Profundo), violeta (Lavanda Pastel + Violeta Tinta) e neutro (Cinza Névoa + Ardósia). Toda tinta tem contraste de pelo menos 5:1 sobre o próprio pastel. Usados em selos de situação, chips de ícone, contadores e faixas de aviso.
- **Cores de linha** (`line-*`): sete linhas (Azul, Verde, Amarela, Lilás, Rubi, Turquesa, Ouro) atribuídas a projetos na ordem de criação, mais a Prata para "sem projeto". Aparecem só como selo circular com inicial, faixa vertical de 4px e segmentos/estações da Linha do dia.

### Tertiary
- **Vermelho Atraso** (`destructive`): texto de erro, prazo vencido, número de "Vencidas" quando maior que zero, botão destrutivo. 6,87:1 sobre branco.
- **Vermelho Agora** (`now`): exclusivamente o marcador vertical e a estação do "agora" na Linha do dia.

### Neutral
- **Cinza-Gelo** (`background`): fundo da área de trabalho e da barra superior.
- **Superfície Branca** (`card`): cartões, rail lateral, navegação inferior, campos, diálogos e listas abertas.
- **Grafite** (`foreground`): texto principal e títulos.
- **Grafite Secundário** (`muted-foreground`): descrições, notas, cabeçalhos de coluna, rótulos de grupo do menu (5,9:1 sobre branco).
- **Cinza Névoa** (`muted`): hover de itens e botões fantasma, esqueletos de carregamento, campo desabilitado.
- **Borda Fria** (`border`): borda de cartões, régua sob o cabeçalho do cartão, linhas de tabela, divisória do rail.
- **Borda de Reforço** (`border-strong`): contorno do botão secundário e tracejado do estado vazio isolado; só reforço, o texto identifica o controle.
- **Contorno de Campo** (`input`): borda de campos e selects, 3:1 contra o branco (WCAG 1.4.11).
- **Cabeçalho de Tabela** (`table-head`): faixa do cabeçalho de tabelas.

### Named Rules
**The One Blue Rule.** Azul sólido significa "ação ou seleção atual": botão principal, item ativo, opção marcada. Não pinte fundos, títulos ou decoração de azul sólido; informação usa o par pastel `tone-info`.

**The Pastel Pair Rule.** Estado é sempre fundo pastel + tinta da mesma família + texto (com ponto ou ícone). Cor nunca nomeia um estado sozinha.

**The Line Ownership Rule.** Cor de linha pertence a projetos. Não use `line-*` em navegação, botões ou estados; se não é um projeto, é tom pastel, cinza ou grafite.

**The Red Is Now Rule.** O vermelho vivo (`now`) aparece só no marcador do agora. Atraso e erro usam o Vermelho Atraso, mais escuro; a paleta de linhas exclui o vermelho para que nenhum projeto pareça urgente.

**The Yellow Outline Rule.** A Linha Amarela não tem contraste contra o branco: todo selo, faixa, segmento ou estação amarela leva contorno de 1px em grafite, e o texto sobre ela é grafite.

## Typography

**Display Font:** Hanken Grotesk Variable (com ui-sans-serif, system-ui)
**Body Font:** Hanken Grotesk Variable (mesma família)

**Character:** Uma única grotesca de desenho calmo, com mais caráter que a Inter, em pesos firmes (600/700) para nomes e títulos e 400 para leitura. Numerais tabulares ligados no `body` inteiro.

### Hierarchy
- **Headline** (700, 26px no celular e 28px a partir de 640px, altura 1,25, -0,025em): H1 de cada página, com a data e o contexto logo abaixo.
- **Stat** (700, 22px no celular e 28px a partir de 640px, linha 32px, -0,02em, tabular): o número dos cartões do dia; vira Vermelho Atraso quando sinaliza atraso.
- **Title** (700, 15px, linha 22px, -0,005em): título de cartão, em caixa normal, com a contagem ao lado em 600 cinza.
- **Lead** (400, 15px): descrição sob o H1, em Grafite Secundário.
- **Body** (400, 14px, linha 20px): tabelas, listas, texto corrido; descrições de estado vazio limitadas a 46ch.
- **Body strong** (600, 14px): nomes de tarefa, botões, itens de menu.
- **Label** (600, 12px): cabeçalhos de coluna, selos de situação, rótulos de grupo do menu, rótulos da navegação inferior. Marcas de hora da Linha do dia usam 11px 500.

### Named Rules
**The Tabular Rule.** Toda hora, data, valor, estimativa e contagem usa numerais tabulares; colunas de número se alinham sem esforço.

**The Sentence Case Rule.** Títulos, rótulos de grupo e cabeçalhos de coluna ficam em caixa normal, sem caixa alta espaçada. Nada fica acima do H1 da página: data e contexto vêm abaixo.

## Layout

Desktop (a partir de 1024px): grade de duas colunas com rail lateral branco de 240px (recolhível para 68px, só ícones com título) e área de conteúdo com barra superior de 56px em cinza-gelo que leva o sino de notificações. O conteúdo é centralizado até 1600px, com respiro lateral de 16px no celular, 20px a partir de 640px e 24px no desktop; 24px separam as seções da página.

Os cartões de número formam uma grade 2x2 no celular e quatro colunas a partir de 1280px, com 12px de vão (16px a partir de 640px). Cartões de seção empilham no celular e se dividem em colunas assimétricas no desktop (lista principal mais larga, prazos ao lado).

Abaixo de 1024px o rail some e entra a navegação inferior fixa de cinco posições (quatro destinos e "Mais", que abre uma folha flutuante acima dela); o conteúdo ganha 112px de respiro inferior. Todo alvo de toque tem pelo menos 44px abaixo de 1024px; no desktop os controles encolhem para 36px. A 768px a Linha do dia passa de vertical para horizontal e as tabelas passam de linha empilhada (metadados sob o título) para colunas.

Registros (tarefa, projeto, cliente) abrem em painel lateral de até 672px sobre a página de origem no desktop, expansível para um modal central de 1056px; no celular viram página inteira. A URL é sempre a do registro.

Ritmo: múltiplos de 4px; os passos reais mais usados são 4, 8, 12, 16, 20 e 24px.

## Elevation & Depth

Híbrido discreto: a profundidade vem primeiro do contraste entre o fundo cinza-gelo e as superfícies brancas com borda fria; a sombra de repouso é só um toque de contato. Uma segunda sombra, mais ampla e difusa, existe apenas para o que flutua.

### Shadow Vocabulary
- **Contato** (`box-shadow: 0 1px 2px rgb(17 24 39 / 0.04), 0 1px 3px rgb(17 24 39 / 0.03)`, token `--elev-card`): cartões, botão principal, botão secundário, item ativo do menu, marca, estações da Linha do dia.
- **Flutuante** (`box-shadow: 0 12px 32px -8px rgb(17 24 39 / 0.18), 0 2px 6px rgb(17 24 39 / 0.06)`, token `--elev-pop`): diálogos, busca global, lista aberta dos selects, seletores de data e hora, folha "Mais", painel de registro, link "Pular para o conteúdo". Diálogos modais ficam sobre véu grafite a 45%.

### Named Rules
**The Whisper Shadow Rule.** No repouso, a sombra mal se vê; se um elemento precisa se destacar, use borda, cor de estado ou o azul primário, não uma sombra mais forte. Sombra ampla é exclusiva do que flutua sobre a página.

## Shapes

Cantos suaves em três degraus, todos derivados de tokens: 8px (`--radius`) em botões, campos, selects, itens de menu e chips pequenos; 12px (`--radius-card`) em cartões, estados vazios e de erro, e na lista aberta do select; 16px em diálogos, popovers, folha "Mais" e no cartão de login. Opções dentro de uma lista aberta usam 6px. Pílula completa em selos de situação, contadores, trilho e segmentos da Linha do dia, selos de linha, faixas de linha e pontos. Círculos só em selos de linha, estações e pontos de estado.

Bordas são de 1px. O estado vazio isolado usa borda tracejada em Borda de Reforço; dentro de um cartão ele perde a moldura.

**The Three Radii Rule.** Controle 8px, cartão 12px, flutuante 16px. Não invente raios intermediários para superfícies novas; a pílula é para selos, trilhos e pontos.

## Components

### Buttons
Firmes e quietos: peso 600, 14px, ícone de 16px à esquerda quando ajuda.
- **Shape:** cantos de controle (8px).
- **Primary:** Azul Profundo com texto branco e sombra de contato; 36px de altura no desktop (44px abaixo de 1024px), 16px de respiro lateral.
- **Hover / Focus:** hover troca para Azul Profundo Pressionado em 150ms ease-out; foco visível é contorno de 3px em azul com 2px de afastamento; desabilitado cai para 50% de opacidade.
- **Outline (secundário):** superfície branca, borda de 1px em Borda de Reforço, sombra de contato; hover em Cinza Névoa. Par habitual do primário no cabeçalho da página ("Novo evento" ao lado de "Planejar o dia").
- **Ghost:** sem fundo, hover em Cinza Névoa; é a ação de cabeçalho de cartão ("Abrir agenda", "Todas") e o "Sair" do rail.
- **Destructive:** Vermelho Atraso com texto branco. **Link:** texto azul sublinhado no hover.

### Chips
- **Selo de situação:** pílula pastel com ponto de 6px na tinta do mesmo tom, 12px 600, 2px por 10px de respiro. A situação de tarefa mapeia a fazer e cancelada para neutro, em andamento para informação, concluída para sucesso; prioridade urgente para perigo e alta para atenção.
- **Chip de ícone:** quadrado arredondado pastel com o pictograma lucide (traço 2) na tinta do tom; 36px com canto de 10px no padrão, 28px/8px no celular e na variante pequena, 44px/12px na variante grande (estado vazio, erro).
- **Selo de linha:** círculo de 24px (20px na variante pequena) na cor da linha do projeto com a inicial em 12px 700; o nome do projeto é o nome acessível. "Sem projeto" usa a Prata com travessão.

### Cards / Containers
- **Corner Style:** 12px.
- **Background:** Superfície Branca sobre o Cinza-Gelo.
- **Shadow Strategy:** contato (ver Elevation & Depth).
- **Border:** 1px em Borda Fria.
- **Internal Padding:** cartão de seção com cabeçalho de 12px por 16px (20px a partir de 640px) separado por régua fina, corpo com 16px no topo e 20px na base; cartão de número com 14px no celular e 20px a partir de 640px.
- **Cabeçalho dividido:** título à esquerda com a contagem logo ao lado, ação fantasma à direita.

### Inputs / Fields
- **Style:** fundo branco, borda de 1px em Contorno de Campo, cantos de 8px, 12px de respiro lateral. 44px de altura e texto de 16px abaixo de 1024px (evita zoom no iOS); 36px e 14px no desktop. Placeholder em Grafite Secundário.
- **Focus:** a borda vira azul e ganha contorno de 3px em azul a 40%, colado ao campo.
- **Error / Disabled:** `aria-invalid` pinta a borda de Vermelho Atraso; desabilitado usa Cinza Névoa e 70% de opacidade.
- **Select:** onde o navegador suporta `appearance: base-select`, o botão e a lista seguem o tema: chevron e check lucide desenhados como máscara SVG `data:` (o chevron gira 180° em 120ms ao abrir), lista em cartão branco de 12px com sombra flutuante e até 352px de altura, opções de 40px (44px em toque) com canto de 6px, hover em Cinza Névoa e opção marcada em Azul Profundo com texto branco e check. Sem suporte, fica o select nativo.

### Navigation
- **Rail (desktop):** branco, 240px, borda direita fria. Marca "P" em quadrado azul de 28px com canto de 8px, campo "Buscar" com atalho Ctrl K em `kbd`, grupos "Dia a dia", "Negócio" e "Conta" rotulados em 12px 600 cinza. Itens de 40px, cantos de 8px, ícone de 18px mais nome em 14px 600 Ardósia; hover em Cinza Névoa; ativo em Azul Profundo sólido com texto branco e sombra de contato. Recolhido, os rótulos de grupo viram um traço curto e os nomes ficam acessíveis por título.
- **Barra superior (desktop):** 56px em Cinza-Gelo com régua inferior; só o sino, com contador em pílula azul.
- **Navegação inferior (celular):** branca, régua superior, cinco células de 56px com ícone de 20px sobre rótulo de 12px; ativo em Azul Profundo sólido. "Mais" abre uma folha flutuante branca de 16px de canto com os demais destinos.

### Stat Cards (signature)
Quatro cartões de número com dados lidos do banco: Planejado hoje (violeta), Vencidas (perigo), A receber em 7 dias (sucesso), Contatos a fazer (atenção). Rótulo em 14px 500 cinza à esquerda, chip de ícone à direita, número em Stat e nota curta em 13px cinza. Enquanto carrega, um esqueleto pulsante ocupa o número.

**The Real Numbers Rule.** Cartão de número só mostra valor real com nota factual. Sem variação percentual, seta de tendência ou minigráfico inventado.

### Linha do dia (signature)
Os compromissos do dia como estações sobre um trilho arredondado de 8px em cinza claro, com segmentos na cor da linha do projeto (blocos de foco a 55%), estações circulares brancas de 22px com aro de 5px na cor da linha, marcas de hora em 11px e o marcador do agora: haste vermelha, estação de aro vermelho e pílula Rosa Pastel "Agora HH:MM". Abaixo de 768px vira lista vertical com trilho à esquerda e a hora em coluna própria. Uma frase de rodapé, separada por régua, diz "Em andamento" e "Próxima estação".

### Tabela de tarefas
Cabeçalho em Cabeçalho de Tabela com rótulos de 12px 600 cinza e ordenação por botão com seta; linhas separadas por Borda Fria, sangrando até a borda do cartão. Colunas: checkbox, selo de linha, tarefa (nome em 600 e projeto em 12px cinza), prazo tabular (vencido em Vermelho Atraso 600), estimativa, prioridade e situação em selos pastel. Abaixo de 768px as colunas viram uma linha de metadados sob o título.

### Estados de página
- **Cabeçalho de página:** H1 com descrição abaixo e ações à direita, quebrando para baixo no celular.
- **Vazio:** chip de ícone neutro grande, título 600, descrição de até 46ch e sempre uma próxima ação. Isolado: área branca de 12px com borda tracejada. Dentro de um cartão: sem moldura (`inset`).
- **Erro:** faixa Rosa Pastel de 12px com chip de ícone de perigo, mensagem em Vermelho Atraso e "Tentar novamente" em botão secundário.
- **Carregando:** cartão com barras pulsantes em Cinza Névoa; o texto fica só para leitor de tela.

**The No Nested Card Rule.** Dentro de um cartão nada desenha outra moldura de cartão: estados vazios usam a variante sem moldura, tabelas sangram até a borda.

## Do's and Don'ts

### Do:
- **Do** usar Azul Profundo sólido para a ação principal, o item ativo da navegação e a opção marcada, e para nada decorativo.
- **Do** nomear todo estado com texto dentro de um par pastel + tinta (`tone-*`), com ponto ou chip de ícone.
- **Do** manter os três raios: 8px em controles, 12px em cartões, 16px no que flutua; pílula em selos e trilhos.
- **Do** dar 44px a todo alvo de toque abaixo de 1024px e 16px de texto aos campos no celular.
- **Do** usar numerais tabulares em horas, datas, valores, estimativas e contagens.
- **Do** colocar data e contexto abaixo do H1, nunca acima.
- **Do** dar a cada projeto seu selo de linha com inicial quando ele aparece em lista, tabela ou na Linha do dia, com contorno grafite na Linha Amarela.
- **Do** desenhar ícones de CSS como máscara SVG em `data:`; a CSP bloqueia estilo e script inline no HTML.
- **Do** conferir AA em todo texto novo: tinta sobre pastel de pelo menos 5:1, campos com contorno de 3:1.

### Don't:
- **Don't** pôr rótulo, sobretítulo ou categoria em caixa alta acima de um título; títulos ficam em caixa normal.
- **Don't** colocar um cartão dentro de outro; use a variante sem moldura do estado vazio e deixe tabelas sangrarem até a borda.
- **Don't** mostrar nos cartões de número variação, tendência ou valor que o banco não fornece.
- **Don't** usar cores de linha em navegação, botões ou estados, nem vermelho fora do agora, do atraso e do erro.
- **Don't** reforçar a sombra de cartões em repouso; sombra ampla é só para diálogos, listas abertas, folhas e painéis.
- **Don't** criar tema escuro ou trocar o primário: tema claro e Azul Profundo são decisões do projeto (D005, D091).
- **Don't** voltar ao vocabulário do mundo anterior: cantos de 2px, placas pretas sólidas, filetes de 2px em tinta e títulos em caixa alta espaçada.

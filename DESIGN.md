---
name: ProjectHub CRM
description: Central pessoal de gestão em tema claro, calma e densa, com neutros frios e um único azul de ação.
colors:
  primary: "#2563eb"
  primary-foreground: "#ffffff"
  background: "#f8fafc"
  foreground: "#0f172a"
  card: "#ffffff"
  muted: "#f1f5f9"
  muted-foreground: "#64748b"
  border: "#e2e8f0"
  destructive: "#ef4444"
  success: "#10b981"
  warning: "#f59e0b"
typography:
  headline:
    fontFamily: "Inter Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: "2rem"
  title:
    fontFamily: "Inter Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: "1.75rem"
  body:
    fontFamily: "Inter Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: "1.5rem"
  label:
    fontFamily: "Inter Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: "1.25rem"
  caption:
    fontFamily: "Inter Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: "1rem"
rounded:
  md: "6px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "8px 16px"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "8px 16px"
  button-ghost:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "8px 16px"
  input-field:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    height: "44px"
    padding: "0 12px"
  nav-link:
    backgroundColor: "{colors.card}"
    textColor: "{colors.muted-foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    height: "44px"
    padding: "0 12px"
  nav-link-active:
    textColor: "{colors.primary}"
  status-badge:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.muted-foreground}"
    typography: "{typography.caption}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
  panel:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "16px"
---

# Design System: ProjectHub CRM

## Overview

**Creative North Star: "A Mesa de Trabalho"**

Uma superfície clara e organizada onde tudo o que importa no dia está ao alcance da mão. A interface é calma, densa e objetiva: informa primeiro e não decora. Neutros frios sustentam a leitura e um único azul de ação marca o que se pode fazer, de modo que a atenção vai para tarefas, agenda e reuniões, nunca para a moldura.

O sistema serve a um profissional autônomo que alterna entre o desktop (gestão com tabelas, filtros e listas densas) e o celular (consulta e ação rápida). A mesma linguagem vale nos dois: no desktop a densidade é maior e a navegação lateral; no mobile entram cartões, navegação inferior e alvos de toque generosos.

**Key Characteristics:**
- Tema claro como padrão aprovado (D005); fundo cinza-azulado muito claro com painéis brancos.
- Um único acento (azul); verde, âmbar e vermelho existem só como estado.
- Plano por padrão: separação por bordas de 1px, não por sombras.
- Tipografia única (Inter) com hierarquia por peso e tamanho, sem display.
- Alvos de toque de 44px em controles e navegação.

## Colors

Paleta fria e contida: neutros azulados, um azul de ação, e três cores de estado usadas com parcimônia.

### Primary
- **Azul de Ação** (#2563eb): único acento do sistema. Botão primário, item de navegação ativo (em 10% de opacidade como fundo), links, contador de não lidas e anel de foco.

### Neutral
- **Névoa Fria** (#f8fafc): fundo da página.
- **Painel Branco** (#ffffff): superfície de cartões, listas, campos e da barra de navegação.
- **Linho Azulado** (#f1f5f9): fundos secundários (muted, accent, hover de itens e badges neutras).
- **Cinza Ardósia** (#64748b): texto secundário, descrições, metadados e ícones inativos.
- **Tinta Noite** (#0f172a): texto principal e títulos.
- **Fio de Gelo** (#e2e8f0): bordas e divisores de 1px, contorno de campos.

### State
- **Verde Concluído** (#10b981): sucesso (badges em 15% de opacidade com texto emerald-800).
- **Âmbar de Atenção** (#f59e0b): aviso e prioridade alta (fundo em 20% com texto amber-900).
- **Vermelho de Risco** (#ef4444): erro, atraso e prioridade urgente; texto de erro e contornos inválidos.

### Named Rules
**The One Blue Rule.** O azul é o único acento; ele aparece em ação, seleção e foco, nunca como decoração. Cores de estado jamais assumem o papel de acento.

**The Tint, Not Fill Rule.** Estados e seleção usam o tom em baixa opacidade (10–20%) sobre texto escuro ou do próprio matiz; preenchimento sólido é exclusivo do botão primário e do contador.

## Typography

**Display Font:** nenhuma; o sistema não usa fonte de exibição.
**Body Font:** Inter Variable (com ui-sans-serif, system-ui, sans-serif)
**Label/Mono Font:** Inter Variable (sem fonte mono)

**Character:** uma única família neutra e legível, com antialiasing; a hierarquia nasce de peso (500–600) e de pouco salto de tamanho, para manter a densidade sem cansar.

### Hierarchy
- **Headline** (600, 1.5rem, 2rem): título de página (`PageHeader`) e valor dos indicadores do dashboard.
- **Title** (600, 1.125rem, 1.75rem): títulos de seção dentro de uma página.
- **Body** (400, 1rem, 1.5rem): campos, texto corrido e itens de lista; 16px nos campos evita zoom no iOS.
- **Label** (500, 0.875rem, 1.25rem): botões, navegação, rótulos de campo, metadados de linha (em Cinza Ardósia).
- **Caption** (500, 0.75rem, 1rem): badges e itens da navegação inferior.

### Named Rules
**The Weight Over Size Rule.** Hierarquia se faz com peso e cor antes de tamanho; o salto máximo de uma página é 24px → 14px.

## Layout

Casca de aplicação: barra lateral fixa de 15rem (240px) a partir de 1024px; abaixo disso, navegação inferior fixa com 4 destinos mais "Mais". Conteúdo em coluna única centralizada (largura máxima 64rem / `max-w-5xl`), com 16px de margem lateral, 24px de respiro entre blocos e folga inferior de 96px no mobile para a navegação.

Densidade: listas com linhas de 44px mínimo (alvo de toque), padding horizontal de 16px e divisores de 1px. Painéis de indicadores em grade de 2 colunas no mobile e 4 no desktop; seções do dashboard em 1 coluna no mobile e 2 a partir de 1024px. Espaçamento em múltiplos de 4px (4, 8, 12, 16, 24, 32).

Pontos de quebra: 640px (intermediário) e 1024px (barra lateral e grade de duas colunas).

## Elevation & Depth

Plano por padrão. Profundidade é comunicada por borda de 1px (Fio de Gelo) e por contraste entre o fundo Névoa Fria e os painéis brancos, não por sombras. Sombras aparecem só como resposta a papel funcional: sombra mínima nos botões de contorno e sombra larga no menu flutuante "Mais" do mobile, que se sobrepõe à navegação.

### Shadow Vocabulary
- **Contorno sutil** (`box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05)`): botão outline.
- **Menu flutuante** (`box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)`): menu "Mais" no mobile.

### Named Rules
**The Flat-By-Default Rule.** Superfícies são planas em repouso; só elementos que flutuam sobre outros ganham sombra.

## Shapes

Cantos suavemente arredondados e uniformes: 6px (rounded-md) em botões, campos, painéis e listas; 9999px apenas em badges e contadores. Bordas de 1px sólidas em Fio de Gelo; o estado vazio usa borda tracejada para indicar "espaço a preencher". Sem recortes, ângulos ou formas decorativas.

## Components

### Buttons
- **Shape:** cantos de 6px, altura de 36px (32px compacto, 40px grande), rótulo Label.
- **Primary:** fundo Azul de Ação, texto branco, padding 8px 16px; hover a 90% de opacidade.
- **Outline:** fundo da página com borda de 1px e sombra mínima; hover em Linho Azulado. Ação secundária de formulário.
- **Ghost:** sem fundo nem borda; hover em Linho Azulado. Ações de linha (Remover, Cancelar) em tamanho `sm`.
- **Foco:** anel de 3px em azul a 50% de opacidade; desabilitado a 50% de opacidade.

### Inputs / Fields
- **Style:** altura de 44px, fundo branco, borda de 1px em Fio de Gelo, cantos de 6px, texto de 16px.
- **Focus:** borda e anel de 3px em azul a 30% de opacidade.
- **Error / Disabled:** borda vermelha quando inválido, mensagem em vermelho abaixo do campo; desabilitado a 60%.

### Navigation
- **Style:** item de 44px de altura, cantos de 6px, rótulo Label. Inativo em Cinza Ardósia com hover em Linho Azulado; ativo com fundo do azul a 10% e texto azul.
- **Contador:** pílula azul sólida com texto branco à direita do item (Notificações); no mobile vira um ponto no "Mais".
- **Mobile:** barra inferior fixa em cinco colunas, texto Caption centralizado, borda superior de 1px.

### Cards / Containers
- **Corner Style:** 6px.
- **Background:** Painel Branco com borda de 1px.
- **Shadow Strategy:** nenhuma em repouso (Flat-By-Default).
- **Internal Padding:** 16px em indicadores; listas usam linhas de 16px × 8px separadas por divisores.

### Status Badge
- **Style:** pílula de Caption com padding 2px 8px; tom neutro (Linho Azulado), sucesso, aviso, perigo ou informação, sempre com texto além da cor.

### Dashboard Tile
Indicador com número em Headline sobre rótulo em Cinza Ardósia, em painel branco; o número vira Vermelho de Risco quando há pendência crítica (atrasadas).

### Empty State
Painel com borda tracejada, título em peso 500 e descrição em Cinza Ardósia, centralizados com 32px de padding; sempre oferece a próxima ação quando houver.

## Do's and Don'ts

### Do:
- **Do** usar o azul (#2563eb) apenas para ação, seleção e foco.
- **Do** separar superfícies com bordas de 1px em #e2e8f0 e deixar as sombras para o que flutua.
- **Do** manter alvos de toque de pelo menos 44px em navegação, linhas de lista e campos.
- **Do** acompanhar toda cor de estado com texto ou ícone (badge com rótulo, mensagem de erro).
- **Do** tratar loading, vazio, erro e sem-permissão em toda lista e painel.
- **Do** manter o texto da interface em português do Brasil.

### Don't:
- **Don't** introduzir um segundo acento nem usar verde, âmbar ou vermelho como cor de marca.
- **Don't** usar sombras em cartões em repouso, gradientes, vidro fosco ou bordas laterais coloridas.
- **Don't** usar fonte de exibição ou tamanhos acima de 24px nas telas de trabalho.
- **Don't** mostrar módulos futuros no menu antes de implementados, nem números ou ações fictícias.
- **Don't** depender só de cor para indicar estado ou prioridade.

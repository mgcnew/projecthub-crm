# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Profissional autônomo de tecnologia que gerencia sozinho seus clientes, projetos, reuniões e tarefas, alternando entre o desktop (trabalho denso de gestão) e o celular (consulta e ações rápidas ao longo do dia). Hoje é um único usuário; o produto nasce multitenant para que equipes possam ser adicionadas depois sem refazer a base.

## Product Purpose

Central pessoal de gestão de projetos, clientes, compromissos, tarefas e reuniões. Sucesso é o usuário abrir o app, ver o que importa hoje (tarefas, agenda, reuniões, lembretes) e agir sem trocar de ferramenta, com dados confiáveis e isolados por organização.

## Positioning

- **Tarefa híbrida:** prazo, dia planejado e bloco de horário são independentes; planejar para um dia ou reservar um bloco nunca altera o prazo.
- **Central do Dia:** um painel que integra tarefas, agenda, reuniões, lembretes e notificações do dia, lendo das entidades de origem.
- **Tudo ligado ao cliente/projeto:** tarefas, reuniões e histórico se vinculam a clientes e projetos (um projeto pode existir sem cliente).
- **Pessoal agora, SaaS depois:** multitenant desde o banco (organização, RLS, FKs compostas).

## Operating Context

Uso diário, em sessões curtas e frequentes: capturar uma tarefa só com o título, planejar o dia, conferir a agenda e abrir reuniões. Desktop com alta densidade de informação (tabelas, filtros, paginação); mobile com cartões, formulários em tela cheia e navegação inferior. Lembretes são entregues como notificações internas pelo servidor (sem push, e-mail ou WhatsApp no MVP).

## Capabilities and Constraints

- Implementado (Fases 0–6): autenticação com verificação em duas etapas (TOTP, imposta no banco) e recuperação de senha; espaço pessoal; clientes e projetos com arquivamento e histórico; tarefas, subtarefas, checklists e modelos; planejamento diário; agenda, reuniões, blocos de trabalho e recorrência mínima; lembretes, notificações internas e Central do dia com atividade recente; fuso de trabalho configurável; busca global (Ctrl/Cmd+K); registros em painel lateral no desktop e página inteira no celular. Falta apenas a publicação do front (Vercel).
- Fora do escopo agora (não criar interfaces vazias): prospecção, funil comercial, WhatsApp, integrações de calendário, biblioteca de conhecimento avançada, cofre de credenciais, financeiro, automações, IA e gestão de planos/equipes. Módulos futuros só aparecem no menu quando implementados.
- Interface somente em português do Brasil (pt-BR); sem internacionalização por enquanto. Confirmado como definitivo.
- Em aberto (não decidido): nome/marca final do produto ("ProjectHub CRM" é o nome atual do projeto, não confirmado como definitivo); tema escuro; atribuição entre membros e visibilidade de perfis de co-membros; exportação e exclusão de conta; exceções de recorrência (D009).
- Regras de produto: toda informação de negócio pertence a uma organização; ações visuais fictícias não são aceitas (tudo opera com dados reais); mobile é parte do critério de pronto.

## Brand Commitments

Nenhuma identidade de marca (logotipo, voz, paleta) foi confirmada como vinculante. Existe apenas o nome de trabalho "ProjectHub CRM".

## Evidence on Hand

Documentação interna em `docs/` (PROJECT_MASTER, UI_UX_SPEC, DATABASE_SPEC, DECISIONS, IMPLEMENTATION_PLAN). Não há clientes, depoimentos, métricas, logotipo ou material de marca; nenhum desses deve ser inventado.

## Product Principles

1. **Dados reais, nunca decorativos:** cada tela opera sobre entidades de origem; nada de números ou ações simuladas.
2. **Planejar não é prometer:** prazo, dia planejado e bloco de horário nunca se alteram mutuamente.
3. **Captura mínima, detalhe sob demanda:** criar algo pede só o título; o resto vem depois.
4. **Confiável antes de abrangente:** lembretes sem duplicidade, isolamento entre organizações e estados de erro/vazio/carregamento sempre tratados.
5. **Um produto, dois contextos:** desktop denso para gestão, mobile enxuto para consulta e ação rápida.

## Accessibility & Inclusion

WCAG 2.2 AA como referência (navegação por teclado, foco visível, ícones e texto além da cor, alvos de toque de 44–48 px no mobile), conforme `docs/UI_UX_SPEC.md`. Tema claro é o padrão aprovado (D005 em `docs/DECISIONS.md`).

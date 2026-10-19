# Fase 7 — Prospecção, funil e envio (e-mail e WhatsApp)

Plano aprovado em 2026-10-19 (D104–D109). Serve para implementação aqui (Claude Code) e no Codex: cada tarefa
7.x é um pull request pequeno, com escopo, critérios de aceite e testes. Leia antes: `AGENTS.md`,
`docs/DECISIONS.md` (D104 em diante), `docs/DATABASE_SPEC.md` (seção "Estado implementado").

## 1. Objetivo

Divulgar os sistemas do usuário a partir de listas de leads: importar, classificar por **temperatura**
(frio, morno, quente) e **etapa do funil**, preparar mensagens personalizadas que não pareçam disparo em massa,
enviar por **e-mail** (Resend) e **WhatsApp** (Evolution API na VPS do usuário), receber respostas e converter o
lead em cliente do CRM.

Sucesso = taxa de **resposta** por modelo e campanha (não abertura de e-mail) e leads convertidos em clientes.

## 2. Decisões que guiam o plano

| # | Decisão | Consequência no sistema |
|---|---|---|
| D104 | Prospecção, funil e WhatsApp saem do "Futuro" e viram a Fase 7 | Captação pelo Google Maps continua futura |
| D105 | Lead **frio só por e-mail**; WhatsApp só para **morno e quente** | Regra imposta **no banco** (trigger), não só na tela |
| D106 | E-mail começa pelo **Resend** (grátis: 3.000/mês, 100/dia); Google Workspace depois | Provedor de e-mail atrás de uma interface (`resend` agora, `smtp`/`gmail` depois) |
| D107 | WhatsApp pelo **Evolution** com o **número da empresa** (não dedicado) | Limites conservadores por padrão, botão "pausar tudo", verificação de número antes de enviar; Cloud API oficial possível depois pela mesma interface |
| D108 | **Sem IA** agora; sistema **preparado para DeepSeek** | Interface de geração de rascunho com provedor `none` (desligado); chave só no servidor |
| D109 | Leads vêm de planilhas com: empresa, telefone, e-mail, site, endereço (e o que mais houver) | Importação CSV com mapeamento de colunas flexível |

### Riscos aceitos e mitigação

- **Número da empresa no WhatsApp (D107):** se o número for bloqueado, perde-se o canal da empresa. Mitigação:
  WhatsApp só para morno e quente (pessoas que já responderam ou conhecem o usuário), no máximo 20 conversas novas
  por dia, intervalos aleatórios de 60 a 240 s, só em dias úteis das 9h às 18h, sequência para ao receber
  resposta, número conferido antes do envio, "SAIR" respeitado sempre. Recomendação registrada: migrar para um
  número dedicado ou para a Cloud API quando o volume crescer.
- **Resend e e-mail frio (D106):** provedores transacionais costumam proibir listas sem consentimento nas regras
  de uso. **Antes da 7.5, o usuário confere a política de uso aceitável do Resend.** Mitigação: volume baixo
  (até 50 por dia no início), e-mails um a um, sem imagens nem rastreamento de abertura, descadastro em todo e-mail
  e lista de supressão.
- **LGPD (não é orientação jurídica):** registrar a origem de cada lead, oferecer saída fácil, honrar a saída em
  todos os canais, guardar só o necessário e excluir a pedido.

## 3. Pré-requisitos do usuário (antes das etapas de envio)

| Para | O que | Quando |
|---|---|---|
| 7.5 E-mail | Domínio próprio verificado no Resend (registros SPF/DKIM no DNS) e um endereço de envio. Sem domínio, o Resend só envia para o próprio e-mail da conta | Antes da 7.5 |
| 7.5 E-mail | Chave de API do Resend. **Quem grava é o usuário:** `npx supabase secrets set RESEND_API_KEY=...` | Antes da 7.5 |
| 7.6 WhatsApp | Evolution acessível por **HTTPS** na VPS, nome da instância e chave de API (gravada pelo usuário como segredo) | Antes da 7.6 |
| 7.6 WhatsApp | Aceite do risco do número da empresa (D107) | Feito |
| 7.10 IA | Chave da DeepSeek (gravada pelo usuário como segredo) | Quando quiser ligar |

Nenhuma chave entra no repositório, no `.env` do front ou no navegador.

## 4. Arquitetura

```
Navegador (React) ──RLS──▶ Postgres (Supabase)
                               │  outbound_messages (fila, só aprovadas são enviadas)
                               │  pg_cron (1 min) ─▶ pg_net ─▶ Edge Function send-outbox
                               │                                 ├─ adapter e-mail: Resend
                               │                                 └─ adapter WhatsApp: Evolution
Evolution (VPS) ──webhook──▶ Edge Function evolution-webhook ─▶ inbound_messages + lead "respondeu"
Resend ──webhook (Svix)──▶ Edge Function resend-webhook ─▶ entregue / bounce / reclamação ─▶ supressão
Link de descadastro ──▶ Edge Function unsubscribe (token assinado) ─▶ supressão
```

Princípios:

1. **O que você aprova é o que sai.** O texto é renderizado ao criar o rascunho e gravado na fila; o envio não
   recalcula nada.
2. **Nada sai sem aprovação** (em lote, com revisão). Sequências geram rascunhos, não envios.
3. **Segredos só nas Edge Functions** (`RESEND_API_KEY`, `EVOLUTION_API_KEY`, `EVOLUTION_URL`,
   `EVOLUTION_INSTANCE`, `WEBHOOK_SECRET`, `UNSUBSCRIBE_SECRET`, `DEEPSEEK_API_KEY`). O front fala só com o Supabase,
   e a CSP do front não muda.
4. **Supressão verificada no envio**, no banco e na Edge Function. Quem saiu nunca mais recebe, em nenhum canal.
5. **Provedores atrás de interfaces:** `EmailProvider` (`resend` | `fake`, depois `smtp`/`gmail`), `WhatsAppProvider`
   (`evolution` | `fake`, depois `cloud_api`), `DraftProvider` (`none` | `deepseek`). Em teste e desenvolvimento
   o provedor é `fake`: nenhum teste fala com serviço real.
6. **Mesmo padrão do CRM:** `organization_id` com FKs compostas, RLS (leitura de membro, escrita só do owner),
   política restritiva `mfa_required`, privilégios por coluna, nada sensível em `activity_logs`.

## 5. Modelo de dados

Todas as tabelas: `id`, `organization_id`, `created_at`, `updated_at`, `unique (organization_id, id)`, RLS,
`mfa_required` e testes pgTAP de isolamento.

| Tabela | Para quê | Campos principais |
|---|---|---|
| `products` | Catálogo dos sistemas que o usuário vende | `name`, `description`, `value_proposition`, `audience`, `demo_url` (http/https), `price_note`, `active` |
| `leads` | Lead (empresa a prospectar) | `company_name` (obrigatório), `contact_name`, `email`, `phone` (E.164, ex. `+5511912345678`), `has_whatsapp` (null = não conferido), `whatsapp_checked_at`, `website`, `address_line`, `city`, `state`, `segment`, `source` (origem, obrigatório), `temperature` (`cold`/`warm`/`hot`), `stage` (`new`/`contacted`/`replied`/`meeting`/`proposal`/`won`/`lost`), `lost_reason`, `hook` (gancho de personalização), `notes`, `product_id` (interesse), `next_contact_on`, `converted_client_id` (FK composta para `clients`), `opted_out_at`, `archived_at`. Únicos parciais por organização: e-mail (minúsculo) e telefone |
| `lead_imports` | Histórico de importações | `file_name`, `total`, `created`, `updated`, `skipped`, `errors` (jsonb, até 200 linhas) |
| `suppression_list` | Nunca contatar | `channel` (`email`/`whatsapp`/`all`), `value` (e-mail minúsculo ou telefone E.164), `reason` (`opt_out`/`bounce`/`complaint`/`manual`). Único por (`organization_id`, `channel`, `value`) |
| `message_templates` | Modelos de mensagem | `name`, `product_id`, `channel`, `temperature`, `step` (1 = primeira, 2 e 3 = lembretes), `subject` (e-mail), `body`, `openings text[]`, `closings text[]`, `active` |
| `campaigns` | Campanha = público + sistema + canal + sequência | `name`, `product_id`, `channel`, `temperature`, `status` (`draft`/`active`/`paused`/`finished`), `daily_limit`, `followup_days int[]` (padrão `{3,7}`) |
| `campaign_leads` | Lead dentro de uma campanha | `campaign_id`, `lead_id`, `step`, `status` (`active`/`replied`/`finished`/`opted_out`/`failed`), `next_step_on` |
| `outbound_messages` | Fila de envio | `lead_id`, `campaign_id`, `template_id`, `channel`, `to_address`, `subject`, `body` (texto final), `status` (`draft`/`approved`/`sending`/`sent`/`failed`/`cancelled`), `approved_at`, `scheduled_for`, `sent_at`, `provider`, `provider_message_id`, `attempts`, `last_error`, `generated_by` (`template`/`ai`) |
| `inbound_messages` | Respostas recebidas | `lead_id` (casado por telefone ou e-mail), `channel`, `from_address`, `body`, `received_at`, `provider_message_id` (único) |
| `outreach_settings` | Configuração (1 por organização) | `email_from`, `email_reply_to`, `email_daily_limit` (50), `whatsapp_daily_limit` (20), `window_start` (09:00), `window_end` (18:00), `weekdays_only` (true), `paused` (false), `draft_provider` (`none`) |

Regras no banco:

- `outbound_messages` com `channel = 'whatsapp'` só aceita lead com `temperature in ('warm', 'hot')` (D105).
- Não aprova nem envia para valor que esteja em `suppression_list` ou para lead com `opted_out_at`.
- Transições de `status` válidas por trigger: rascunho → aprovado → enviando → enviado/falhou; cancelado a
  partir de rascunho ou aprovado.
- Corpo, assunto e endereço ficam **fora de `activity_logs`**. Só a mudança de etapa e de temperatura do lead entra
  na trilha.

## 6. Mensagens que não parecem robô

1. **Placeholders:** `{{empresa}}`, `{{contato}}` (cai para "tudo bem?" sem nome), `{{gancho}}`, `{{sistema}}`,
   `{{proposta}}` (proposta de valor), `{{demo}}` (link, só a partir do passo 2).
2. **Variações** de abertura e fechamento escolhidas de forma **determinística por lead** (hash do id do lead com o
   id do modelo): o mesmo lead sempre vê a mesma combinação, e leads diferentes recebem textos diferentes.
3. **Gancho por lead:** um campo curto e específico (o que viu no site, o segmento, uma dor). A fila mostra os leads
   sem gancho, e o modelo pode exigir gancho.
4. **Verificador de estilo** (avisos, não bloqueio) ao salvar o modelo e ao revisar o rascunho:
   - primeira mensagem com mais de 600 caracteres (e-mail) ou 300 (WhatsApp);
   - link na primeira mensagem; mais de uma pergunta;
   - frases-clichê ("espero que esteja bem", "venho por meio desta", "solução inovadora", "alavancar") e excesso de
     emojis ou exclamações;
   - placeholder sem valor para aquele lead.
5. **Sequência:** passo 1 curto, com uma pergunta; passo 2 em D+3 e passo 3 em D+7, mais curtos; depois encerra.
   Resposta interrompe tudo.
6. **IA preparada (D108):** `DraftProvider` com `generate(lead, product, template, styleGuide)` em uma Edge Function
   `draft-message`. Fica `none` até o usuário ligar; com `deepseek`, o resultado vira **rascunho** marcado
   `generated_by = 'ai'` e passa pelo mesmo verificador e pela mesma aprovação. O guia de estilo fica em
   `supabase/functions/_shared/style-guide.md`.

## 7. Telas

Nova área **Prospecção** no menu (`/app/prospeccao`), com abas:

| Aba | Conteúdo |
|---|---|
| Leads | Tabela com filtros (temperatura, etapa, origem, segmento, sistema, sem gancho), busca, ações em lote (temperatura, etapa, incluir em campanha, arquivar); painel do lead com dados, linha do tempo (enviadas e recebidas), gancho e "Converter em cliente" |
| Importar | Upload CSV, mapeamento de colunas, pré-visualização, normalização (+55), duplicados (pular ou atualizar), resumo |
| Campanhas | Criar e pausar; métricas por campanha (enviadas, respostas, taxa) |
| Modelos | Modelos por sistema, canal, temperatura e passo, com variações e pré-visualização com um lead real |
| Fila | Rascunhos para revisar, editar e aprovar em lote; agendadas; enviadas; falhas |
| Respostas | Caixa de entrada (WhatsApp; e-mail marcado à mão até o Workspace) |
| Sistemas | Catálogo de produtos |
| Configurações | Limites, janela de envio, remetente, "pausar tudo", estado da conexão do WhatsApp |

Na Central do dia: placas **Respostas novas** e **Aguardando aprovação**. A busca global passa a incluir leads.

## 8. Etapas (cada uma é um pull request)

Formato de cada etapa: **Escopo · Fora de escopo · Critérios de aceite · Testes obrigatórios · Quem**.
"Codex" = adequada para o Codex; "Aqui" = sensível (segredos, webhooks, RLS nova de envio), feita ou revisada aqui.

### 7.0 Fundação (Aqui) — feita junto com este plano
- Documento mestre, `DECISIONS` (D104–D109), Fase 7 no `IMPLEMENTATION_PLAN`, regras no `AGENTS.md`.

### 7.1 Leads e supressão (Codex, revisão da RLS aqui)
- **Escopo:** migração `leads`, `suppression_list`, `outreach_settings`; RLS, `mfa_required`, privilégios por coluna;
  normalização de telefone (`src/lib/phone.ts`, E.164, padrão +55); lista e painel do lead (criar, editar,
  arquivar, temperatura, etapa, gancho); menu "Prospecção".
- **Fora:** importação, mensagens, envio.
- **Aceite:** lead criado e editado pela tela; e-mail e telefone duplicados recusados com mensagem clara; filtros
  por temperatura e etapa; usuário B não vê leads de A.
- **Testes:** pgTAP (isolamento, owner, únicos, CHECKs), unitários do telefone, integração com Auth real, E2E
  desktop e celular com axe.

### 7.2 Importação CSV (Codex)
- **Escopo:** leitor de CSV próprio e testado (aspas, `;` ou `,`, UTF-8 com BOM); mapeamento de colunas com
  sugestão automática (empresa, telefone, e-mail, site, endereço, cidade, UF, segmento, contato); pré-visualização;
  validação por linha; duplicados (pular ou atualizar campos vazios); origem obrigatória; `lead_imports` com
  resumo; até 5.000 linhas por arquivo; leads importados entram como **frio**.
- **Aceite:** arquivo de exemplo com 20 linhas, 3 duplicadas e 2 inválidas importa 15, atualiza ou pula 3 e
  reporta 2 com o motivo.
- **Testes:** unitários do parser e do mapeamento (casos ruins), E2E com upload de fixture.

### 7.3 Sistemas e modelos (Codex)
- **Escopo:** `products`, `message_templates`; renderizador puro (`src/features/outreach/render.ts`) com placeholders e
  variação determinística; verificador de estilo (`lint.ts`); pré-visualização com lead real.
- **Aceite:** o mesmo lead sempre recebe o mesmo texto; dois leads recebem variações diferentes quando há
  variações; avisos aparecem para link no passo 1 e para clichês.
- **Testes:** unitários do render e do lint (tabela de casos), pgTAP, E2E.

### 7.4 Fila e aprovação, sem envio real (Codex, regras do banco revisadas aqui)
- **Escopo:** `outbound_messages`; gerar rascunhos para leads selecionados (lead × modelo); revisar, editar,
  aprovar em lote, cancelar; regras no banco (D105, supressão, transições de status); placa "Aguardando
  aprovação".
- **Aceite:** tentar WhatsApp para lead frio falha no banco com mensagem clara; lead suprimido não gera rascunho;
  aprovado fica "aprovado" e nada é enviado.
- **Testes:** pgTAP das regras, integração, E2E.

### 7.5 E-mail via Resend (Aqui)
- **Escopo:** `supabase/functions/send-outbox` (lote por minuto, limites diários, janela, `paused`), adapter
  Resend e `fake`; `pg_cron` + `pg_net` chamando a função com segredo; `unsubscribe` (token HMAC por lead) com
  cabeçalhos `List-Unsubscribe`; `resend-webhook` com verificação de assinatura (bounce e reclamação → supressão);
  e-mail em texto simples, sem rastreamento de abertura.
- **Aceite:** com provedor `fake`, aprovados viram enviados respeitando limite e janela; descadastro adiciona à
  supressão e cancela pendentes; nenhuma chave aparece no bundle (`check:bundle`).
- **Testes:** testes Deno das funções (fetch simulado), pgTAP, E2E com `fake`. Teste real com o Resend só manual,
  pelo usuário, para o próprio e-mail.

### 7.6 WhatsApp via Evolution (Aqui)
- **Escopo:** adapter Evolution em `send-outbox` (intervalo aleatório de 60 a 240 s, limite diário, janela);
  checagem de número (endpoint do Evolution) em lote antes do envio; `evolution-webhook` com segredo (respostas →
  `inbound_messages`, lead "respondeu", sequência interrompida, notificação; estado da conexão); "SAIR" → supressão;
  botão "pausar tudo".
- **Aceite:** com `fake`, só morno e quente saem; resposta recebida para a sequência e notifica; "SAIR" suprime em
  todos os canais.
- **Testes:** Deno com payloads reais do Evolution (fixtures), pgTAP, E2E com `fake`. Teste real só manual, para
  um número do próprio usuário.

### 7.7 Campanhas e sequências (Codex, revisão aqui)
- **Escopo:** `campaigns`, `campaign_leads`; incluir leads (filtro ou seleção); lembretes D+3 e D+7 geram
  **rascunhos** (pg_cron), não envios; pausar e encerrar.
- **Aceite:** lead que respondeu não recebe lembrete; campanha pausada não gera rascunhos.

### 7.8 Respostas e conversão (Codex)
- **Escopo:** aba Respostas, linha do tempo do lead, temperatura automática (respondeu → morno; reunião ou proposta →
  quente), "Converter em cliente" (cria cliente, contato e projeto opcional; guarda `converted_client_id`), placa
  "Respostas novas", leads na busca global.
- **Aceite:** converter não duplica cliente já existente com o mesmo e-mail (oferece vincular).

### 7.9 Métricas (Codex)
- Taxa de resposta por campanha, modelo, canal e temperatura; leads por etapa; convertidos no mês.

### 7.10 Rascunho com IA, preparado e desligado (Aqui)
- `draft-message` com `DraftProvider` (`none` | `deepseek`), guia de estilo, limite de uso por dia, botão só
  quando ligado. Mesma aprovação e mesmo verificador.

## 9. Como trabalhar com o Codex sem um quebrar o outro

1. **Uma branch por etapa** (`feat/7.1-leads`), **pull request** para a `main` e **CI verde** como condição de merge.
   Nada vai direto para a `main`.
2. **Uma etapa por vez em cada área.** Antes de começar: `git pull` e conferir se não há PR aberto mexendo nos
   mesmos arquivos.
3. **Migrações:** nome com data e hora (`AAAAMMDDHHMMSS_*.sql`); nunca editar migração já aplicada; ao terminar,
   gerar os tipos (`npm run db:types`).
4. **Pedido para o Codex** (copie e preencha):

   ```text
   Tarefa 7.X do docs/PROSPECCAO_PLAN.md. Leia AGENTS.md e docs/DECISIONS.md (D104+).
   Trabalhe na branch feat/7.X-<nome>. Implemente só o escopo da 7.X; o que estiver em "Fora de escopo" não entra.
   Critérios de aceite e testes obrigatórios: os da 7.X.
   Antes de abrir o PR rode: npm run lint && npm run typecheck && npm test && npm run build && npm run db:test
   && npm run test:integration && npm run test:e2e. Relate comandos e resultados no PR.
   Registre decisões novas em docs/DECISIONS.md.
   ```

5. **Revisão aqui:** traga o número do PR e eu reviso (correção, RLS, segredos, testes) antes do merge.
6. **Banco hospedado:** migrações só são aplicadas no hospedado **depois do merge**, com conferência por
   `scripts/db-fingerprint.sql`.

## 10. Fora da Fase 7

Captação de leads pelo Google Maps, Cloud API oficial do WhatsApp (só a interface fica pronta), envio pelo Google
Workspace (depois do Resend), rastreamento de abertura, agendamento público de reunião e página pública por sistema.

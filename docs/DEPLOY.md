# Deploy — Vercel (front) + Supabase hospedado

Estado: **arquivos prontos, nada publicado**. Este roteiro separa o que já está no repositório do que só
você pode fazer (contas, chaves, domínio). Eu nunca uso nem peço senhas ou chaves privadas.

> Não verificado neste ambiente: o comportamento no Vercel e no Supabase hospedado. Cada etapa abaixo
> termina com uma verificação para você conferir na hora, em vez de eu afirmar de antemão.

## O que já está pronto no repositório

| Arquivo | Para quê |
|---|---|
| [vercel.json](../vercel.json) | build (`npm run build` + varredura de segredos), saída `dist`, **rewrite da SPA** para `index.html`, **CSP estrita e demais cabeçalhos**, cache imutável para `/assets/*` e `no-cache` no HTML, `noindex` |
| [config/vercel-config.ts](../config/vercel-config.ts) | fonte do `vercel.json`; reaproveita `config/security-headers.ts`, a mesma política verificada no E2E (`csp.e2e.ts`) |
| `npm run deploy:config [origem]` | regenera o `vercel.json` (sem argumento: `https://*.supabase.co`; com a origem exata do projeto, o `connect-src` fica mais estrito) |
| [.env.production.example](../.env.production.example) | as duas variáveis públicas do front |
| [.vercelignore](../.vercelignore) | o que não sobe no deploy por CLI |
| teste `src/lib/vercelConfig.test.ts` | falha se o `vercel.json` sair de sincronia com o gerador |

## 0. Antes de começar (pendências que são suas)

- [x] **Repositório remoto.** Feito em 2026-10-13: repositório **privado** `mgcnew/projecthub-crm`, `main` enviada.
      A Vercel importa a partir dele.
- [ ] **CI no GitHub.** O workflow `.github/workflows/ci.yml` nunca rodou fora desta máquina (inclui os jobs
      `database` e `e2e`). Depois do primeiro push, confirme que os três jobs ficam verdes.
- [ ] **Banco do zero.** Rode `npm run db:reset` localmente (apaga só o banco local) e depois
      `npm run db:test && npm run test:integration && npm run test:e2e`. É a prova de que as migrações, em
      sequência, constroem o esquema inteiro.
- [ ] Leia a seção "Antes de publicar" de [SECURITY_REVIEW.md](SECURITY_REVIEW.md).

## 1. Supabase hospedado (você)

> **Já feito em 2026-10-13 (passos 1 a 3):** projeto `gnissqsrpzadthapdpue` (sa-east-1) com as 15 migrações
> aplicadas (a 11ª, `mfa_enforcement`, conferida por hash e teste de fumaça com leitura e escrita em aal1
> bloqueadas; a 12ª, `access_directory`, conferida por hash), `pg_cron` ativo com o job `process-due-reminders` e histórico registrado em
> `supabase_migrations.schema_migrations`. As migrações foram aplicadas por SQL via MCP (a CLI deste ambiente
> está logada em outra conta e não tinha a senha do banco). A paridade foi conferida contra o banco local:
> colunas, políticas, privilégios por coluna, índices, constraints, gatilhos e RLS com hashes idênticos, e as
> 18 funções idênticas ignorando comentários. Se for usar `supabase link`/`db push` depois, o histórico já está
> alinhado e a CLI não deve reaplicar nada. **Faltam os passos 4 a 7** (Auth, Data API, usuário e chaves).

1. **Criar o projeto** em supabase.com. Região sugerida: `South America (São Paulo)`. Guarde a senha do banco
   num gerenciador de senhas (nunca no repositório).
   - Planos, backups e PITR dependem do plano contratado: confirme na tela do plano o que ele inclui.
2. **Aplicar as migrações**:

   ```bash
   npx supabase login
   npx supabase link --project-ref SEU_REF
   npx supabase db push --dry-run   # mostra o que será aplicado, sem aplicar
   npx supabase db push
   ```

   - A migração de lembretes usa `pg_cron`. Se o `db push` reclamar da extensão, habilite-a em
     *Database → Extensions → pg_cron* e rode o `db push` de novo.
3. **Conferir o banco**:

   ```bash
   npx supabase db lint --linked
   ```

   No painel, *Advisors* (Security e Performance) não deve listar erros de RLS. No *SQL Editor*:
   `select jobname, schedule from cron.job;` deve mostrar `process-due-reminders` (`* * * * *`).
4. **Autenticação** (*Authentication*):
   - **Desligar o cadastro público** ("Allow new users to sign up" = off). É a decisão D024.
   - Política de senha: mínimo de 12 caracteres, com maiúscula, minúscula e dígito.
   - *URL Configuration*: **Site URL** = o domínio final (passo 3.4); **Redirect URLs** = só esse domínio.
   - **"Esqueci a senha" já existe no app** (`/recuperar-senha`): depende de *Redirect URLs* conter
     `https://SEU_DOMINIO/redefinir-senha` e de um e-mail que chegue. O SMTP padrão do Supabase tem limite baixo
     e só entrega a membros da equipe do projeto; para uso real, configure SMTP próprio.
   - **MFA (TOTP):** o app tem a tela em *Configurações → Verificação em duas etapas*. Confirme em
     *Authentication → Multi-Factor* que TOTP está habilitado (inscrição e verificação). Depois de ativar pela tela,
     o banco passa a exigir o código (D082). **Guarde o segredo** num gerenciador de senhas: não há códigos de
     recuperação (RUNBOOK, "Perdi o autenticador").
5. **Data API** (*Settings → API*): deixe exposto só o schema `public` (remova `graphql_public`).
6. **Criar seu usuário**: *Authentication → Users → Add user* (e-mail e senha, "Auto Confirm User"). O banco
   provisiona perfil e organização pessoal sozinho.
7. **Chaves**: em *Settings → API*, copie a **Project URL** e a **Publishable key**. Só esses dois valores
   vão para o front. A *secret key* e a senha do banco **nunca** saem do painel.

Verificação (cadastro público fechado; deve falhar com "Signups not allowed"):

```bash
curl -s -X POST "https://SEU_REF.supabase.co/auth/v1/signup" \
  -H "apikey: SUA_PUBLISHABLE_KEY" -H "Content-Type: application/json" \
  -d '{"email":"teste@example.com","password":"Senha-Forte-123"}'
```

## 2. Gerar o `vercel.json` com a origem exata (opcional, recomendado)

O arquivo no repositório aceita qualquer `*.supabase.co`. Com o seu projeto criado, fixe a origem:

```bash
npm run deploy:config -- https://SEU_REF.supabase.co
git add vercel.json && git commit -m "chore: connect-src do deploy com a origem exata do Supabase"
```

O teste `vercelConfig.test.ts` continua valendo: ele lê a origem do próprio arquivo e confere que todo o resto
é exatamente o que o gerador produz.

## 3. Vercel (você)

1. **Importar**: *Add New → Project* e escolha o repositório. Framework: Vite (detectado). O `vercel.json`
   define build, saída e rewrite; não precisa mudar nada no painel.
2. **Node.js**: em *Settings → General → Node.js Version*, use 22.x ou 24.x (`package.json` pede ≥ 22).
3. **Variáveis de ambiente** (*Settings → Environment Variables*), só em **Production**:
   - `VITE_SUPABASE_URL` = a Project URL
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = a Publishable key
   - **Previews:** não defina as variáveis em Preview. Um preview com as mesmas chaves falaria com o banco
     real; prefira desligar deploys de preview ou protegê-los (*Deployment Protection*).
4. **Domínio**: *Settings → Domains*. Volte ao Supabase e ajuste *Site URL* e *Redirect URLs* para ele.
5. **Deploy**. O build roda `check:bundle` e **falha** se houver segredo privilegiado no `dist/`.

## 4. Verificações pós-deploy

```bash
# 1) cabeçalhos de segurança no HTML
curl -sI https://SEU_DOMINIO/ | grep -i -E "content-security-policy|strict-transport|x-frame|x-content-type|x-robots"

# 2) rewrite da SPA: rota interna responde 200 (e não 404)
curl -s -o /dev/null -w "%{http_code}\n" https://SEU_DOMINIO/app/tarefas

# 3) assets com cache imutável
curl -sI https://SEU_DOMINIO/assets/$(curl -s https://SEU_DOMINIO/ | grep -o 'assets/[^"]*\.js' | head -1 | cut -d/ -f2) | grep -i cache-control
```

No navegador (com o console aberto, sem erros de CSP):

- [ ] Login com o usuário criado; F5 em `/app` e em `/app/tarefas`.
- [ ] Criar cliente → projeto → tarefa; concluir e conferir na Central do dia.
- [ ] Em Configurações, escolher o fuso; criar um evento e conferir o horário.
- [ ] Criar um lembrete para daqui a 2 minutos e conferir a notificação (prova o `pg_cron` em produção).
- [ ] Abrir uma tarefa a partir da Central do dia (painel lateral), recarregar (F5) e fechar.
- [ ] No celular: navegação inferior, captura rápida e uma tarefa como página inteira.
- [ ] Sair e tentar abrir `/app` direto: deve voltar ao login.

## 5. Backups e restauração

Siga [RUNBOOK.md](RUNBOOK.md). Os passos do projeto hospedado estão marcados lá como *a validar*: o primeiro
ensaio real (dump com `supabase db dump --linked` e restauração num projeto vazio) deve ser feito logo após o
primeiro deploy e registrado na tabela de ensaios.

## 6. Reverter

- **Front**: *Deployments* → deploy anterior → *Promote to Production* (instantâneo).
- **Banco**: as migrações só andam para frente. Para voltar, escreva uma migração nova que desfaça a mudança
  (todas as do projeto são aditivas ou revogam privilégios) ou restaure do backup (RUNBOOK).
- **Chave exposta por engano**: gire-a no painel do Supabase e redeploy; o histórico do Git não é apagado, então
  trate a chave como comprometida.

## 7. Limitações conhecidas

- Sem monitoramento externo, alertas ou logs agregados: use os logs da Vercel e do Supabase por enquanto.
- O worker de lembretes é um job `pg_cron` por minuto; se o projeto for pausado (plano gratuito), os lembretes
  param e voltam sozinhos (janela de recuperação de 24 h, D049).
- Usuário único: a atribuição entre membros e a visibilidade de perfis (D023) não foram desenhadas.
- Integrações externas, push e WhatsApp seguem fora do escopo (D011).

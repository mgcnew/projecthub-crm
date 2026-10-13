# Runbook — backup e restauração (Fase 6.5)

Escopo: dados do ProjectHub CRM no Postgres do Supabase. **Ensaiado no Supabase local.** Os passos do projeto
hospedado estão marcados como *a validar* porque o projeto ainda não existe.

## O que é (e o que não é) backup

| Item | Onde vive | Backup |
|---|---|---|
| Esquema (tabelas, RLS, funções, `pg_cron`) | `supabase/migrations/` (Git) | o próprio Git; `schema.sql` do backup é só referência |
| Dados de negócio (`public.*`) | Postgres | `data.dump` |
| Contas (`auth.users`, `auth.identities`) | Postgres (schema `auth`) | `data.dump` |
| Configuração do Auth (signup, SMTP, senha, URLs) | painel/`config.toml` | documentada em `docs/SECURITY_REVIEW.md`; refazer no projeto |
| Segredos (chaves, SMTP) | gerenciador de segredos do host | **fora do backup, por desenho** |
| Storage / Edge Functions | — | não usados |

Os arquivos contêm **dados pessoais**: guarde criptografados e fora do Git (`backups/` está no `.gitignore`).

## Objetivos propostos (confirmar com o proprietário)

- **RPO** (perda tolerada): 24 h → um backup lógico por dia, mais o PITR do plano se existir.
- **RTO** (tempo para voltar): 1 h para subir um projeto novo, aplicar migrações e restaurar dados.
- **Retenção:** 7 diários + 4 semanais, 1 cópia fora do mesmo provedor.

## Rotina local

```bash
npm run db:backup           # cria backups/<UTC>/ com data.dump, schema.sql, counts.tsv e SHA256SUMS
npm run db:restore-check    # restaura o backup mais recente num banco descartável e verifica
```

O `db:restore-check` executa, sem tocar no banco `postgres` (só leitura) e removendo o banco de teste ao final:

1. confere os SHA-256 dos arquivos;
2. cria um banco novo a partir de `template0`;
3. cria o esquema (stub de `auth` + `public`/`private` com privilégios);
4. restaura os dados com gatilhos desligados (não regrava auditoria nem dispara workers);
5. compara a contagem de cada tabela com o manifesto;
6. verifica FKs sem órfãos, RLS em todas as tabelas e o número de políticas;
7. como o usuário com mais tarefas (papel `authenticated`), confere que a RLS mostra o mesmo número de tarefas na
   origem e no restaurado.

Sai com código ≠ 0 em qualquer divergência (testado com manifesto adulterado e `data.dump` corrompido).

## Restaurar de verdade (banco novo)

1. Criar o projeto/instância Postgres do Supabase vazio.
2. Aplicar o esquema pelas migrações: `npx supabase link --project-ref <ref>` e `npx supabase db push`.
3. Restaurar os dados com gatilhos desligados (superusuário local; no hospedado ver *a validar*):
   ```bash
   pg_restore --data-only --disable-triggers --no-owner --exit-on-error \
     -d "$DATABASE_URL" backups/<UTC>/data.dump
   ```
4. Rodar `npm run db:restore-check` equivalente contra o destino (contagens e RLS) e `supabase test db`.
5. Reconfigurar Auth (signup desligado, SMTP, URLs) e secrets do host; apontar o front para o novo projeto.
6. Conferir o worker de lembretes: `select * from cron.job where jobname = 'process-due-reminders';`.

Atenção: restaurar dados **antigos** sobre um banco que já recebeu migrações novas exige que a migração seja
compatível com o dump (colunas). Prefira restaurar com o mesmo conjunto de migrações do dia do backup.

## Projeto hospedado (*a validar* no primeiro ensaio)

- Backups automáticos e PITR dependem do plano contratado: **não verificado**.
- Backup lógico: `npx supabase db dump --linked --data-only -f data.sql` (e `--schema auth` para as contas).
- No hospedado o papel `postgres` não é superusuário: o dump gerado pela CLI usa
  `SET session_replication_role = replica` no cabeçalho em vez de `--disable-triggers`.
- Primeira ação no ambiente de produção: executar este ensaio completo e registrar abaixo.

## Registro de ensaios

| Data | Ambiente | Backup | Resultado |
|---|---|---|---|
| 2026-10-13 | Supabase local (PG 17.11) | 21 tabelas, 733 linhas, 192 KB | Restauração verificada: contagens iguais, 51 políticas, FKs sem órfãos, RLS idêntica. Negativos: manifesto adulterado e dump corrompido reprovados; 0 bancos de teste remanescentes |
| 2026-10-13 | Supabase local (PG 17.11) | 22 tabelas, 3.571 linhas, 416 KB | Restauração verificada: contagens iguais, 75 políticas, FKs sem órfãos, RLS idêntica; usuário de teste vê as mesmas 11 tarefas. Achado: o stub de `auth` não tinha `auth.mfa_factors` nem `auth.jwt()` (migração do MFA); corrigido no script |

## Perdi o autenticador (MFA)

O Auth não oferece códigos de recuperação e o banco exige aal2 de quem tem fator verificado (D082). Sem o
aplicativo, a conta fica sem acesso aos dados. Quem administra o projeto remove o fator (o usuário continua com a
senha e pode ativar de novo em Configurações):

```sql
-- SQL Editor do Supabase (ou MCP execute_sql). Confira o e-mail antes de rodar.
delete from auth.mfa_factors
 where user_id = (select id from auth.users where email = 'voce@exemplo.com');
```

Depois, entre só com a senha e reative a verificação em duas etapas, guardando o segredo no gerenciador de senhas.
Esta operação é a única forma de "desligar" o MFA sem o código; registre quando for feita.

## Falhas conhecidas / pontos de atenção

- O dump emite avisos de FKs circulares (`tasks`, `meetings`, `calendar_events`): esperado; o `--disable-triggers`
  resolve na restauração.
- O stub de `auth` no ensaio vem do esquema do banco de origem (`auth.users`/`auth.identities`), sem os triggers
  (`on_auth_user_created` aponta para `private.*`). Em restauração real, os triggers de `auth.users` vêm das migrações.
- O ensaio usa o mesmo servidor Postgres da origem; ele valida o conteúdo e a RLS, **não** a recuperação de disco.

# Cofre de senhas (Fase 8) — desenho, limites e operação

Decidido com o usuário em 2026-11-07 (D120–D125). Substitui, só para as **senhas de acessos**, a regra "o app nunca
guarda senha" (D086): o diretório de acessos continua sem campo de senha; a senha vai para o **cofre**, cifrada no
navegador.

## Desenho

- **Cifra no navegador** (Web Crypto, sem biblioteca nem WASM; a CSP continua estrita). O servidor nunca vê a senha
  mestra, a chave de dados nem o conteúdo guardado.
- **Chave em duas partes.** Senha mestra → PBKDF2-SHA256 (600.000 iterações, sal de 16 bytes) → 64 bytes: *chave do
  cliente* (32) e *prova* (32). A chave de dados (DEK, AES-256, aleatória) é embrulhada (AES-GCM) por
  HKDF(chave do cliente ‖ *parte do servidor*). A parte do servidor (32 bytes aleatórios) fica no **Vault do
  Supabase**, fora das tabelas comuns, e só sai por `vault_unlock` depois de conferir a prova.
- **Verificador:** o banco guarda `HMAC-SHA256(prova, parte do servidor)`; quem tem só um dump não consegue testar
  senhas offline sem a parte do servidor.
- **Tentativas (no banco, função `private.vault_check`):** 3 erros seguidos bloqueiam por 15 min (nem a senha certa
  abre durante o bloqueio); ao chegar em `max_attempts` (3 a 10, padrão 5, escolhido na criação) o cofre é
  **destruído**: parte do servidor, chave embrulhada e itens apagados. Acerto zera a contagem. Exige dono ativo
  e MFA satisfeito, como as tabelas.
- **Itens:** um por acesso (`vault_items`): IV + texto cifrado de `{senha, notas}`; o id do acesso entra como dado
  autenticado (AAD), então um item não vale em outro acesso. Sem segredo de 2FA no cofre (anularia o segundo fator).
- **Sessão:** a DEK vive só na memória (chave não extraível), some ao travar (manual, 5 min sem uso, troca de usuário
  ou recarregar a página) e nunca vai para `localStorage`. A cópia da senha sobrescreve a área de transferência em 30 s;
  a senha exibida se oculta em 15 s.
- **Trocar a senha mestra:** `vault_rekey` (exige a prova atual e conta tentativas); a DEK e os itens não mudam.
- **Backup:** arquivo JSON criptografado (`cofre-voltier-AAAA-MM-DD.json`): sal, DEK embrulhada **só pela senha
  mestra** e os itens já cifrados. Restaurar recria o cofre (parte do servidor nova) e devolve os itens dos acessos
  que ainda existem.

## Limites honestos

- A trava protege contra adivinhação **pelo app**. Quem tiver o banco **e** a parte do servidor (a chave do Vault do
  Supabase) ainda pode tentar senhas offline: a defesa é a senha mestra forte (14+ caracteres) e o custo do PBKDF2.
- Sem recuperação: esqueceu a senha mestra e perdeu o backup, perdeu as senhas guardadas.
- **O backup do banco (`db:backup`, backup do Supabase) não leva a parte do servidor** (fica no schema `vault`).
  Depois de restaurar o banco o cofre não abre mais ("missing"): destrua-o em Configurações → Cofre e **restaure do
  arquivo de backup**. Por isso o arquivo exportado é obrigatório na rotina.
- Qualquer pessoa com a sua sessão aberta (e MFA) pode **destruir** o cofre errando a senha mestra N vezes. É o preço
  da trava; o arquivo de backup é o seguro.
- Se um XSS rodar no app com o cofre destrancado, ele alcança as senhas desse momento. Mitigação: CSP estrita,
  trava por inatividade, DEK não extraível.

## Etapas

- **8.1** (esta): migração `20261107100000_vault`, pgTAP 015, criptografia (`src/lib/vaultCrypto.ts`), cofre em
  Configurações → Cofre, aba **Senha** no acesso e selo "Senha no cofre" na lista.
- **8.2** (junto): exportar e restaurar o backup criptografado.
- Depois, se fizer sentido: gerador de senhas, troca do limite de tentativas, importação de gerenciador.

## Operação (hospedado)

1. A migração só é aplicada no hospedado **depois do merge** (D110), com conferência por
   `scripts/db-fingerprint.sql`. O Vault (`supabase_vault` 0.3.1) já está instalado no projeto.
2. Conferir no painel que o schema `vault` não faz parte dos backups exportados (a validar no primeiro ensaio).
3. Primeira vez: criar o cofre, guardar uma senha de teste, **exportar o backup e testar a restauração**.

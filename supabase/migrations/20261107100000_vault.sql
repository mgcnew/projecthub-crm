-- Fase 8.1 (D120–D124): cofre de senhas com criptografia no navegador.
--
-- O servidor NUNCA vê a senha mestra nem as senhas guardadas. A chave de dados (DEK) é aleatória, nasce no
-- navegador e fica "embrulhada" (AES-GCM) por uma chave derivada de DUAS partes:
--   1. a parte do cliente: PBKDF2 da senha mestra (não sai do navegador);
--   2. a parte do servidor (`share`): guardada no Vault do Supabase (criptografada em repouso, fora das
--      tabelas comuns) e só entregue por `vault_unlock` depois de conferir a prova da senha mestra.
-- `vault_unlock` conta as tentativas erradas: 3 seguidas bloqueiam por 15 min; ao chegar em `max_attempts`
-- (padrão 5) o cofre é destruído (parte do servidor, chave embrulhada e itens apagados).
-- Limite honesto: o contador protege contra adivinhação PELO APP. Quem copiar o banco e a parte do servidor
-- ainda pode testar senhas offline; a defesa aí é a força da senha mestra e o custo do PBKDF2.

create extension if not exists supabase_vault;

-- --------------------------------------------------------------- vault_meta
create table public.vault_meta (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  salt bytea not null check (octet_length(salt) = 16),
  kdf_iterations integer not null check (kdf_iterations between 600000 and 5000000),
  -- DEK (32 bytes) + etiqueta GCM (16 bytes)
  wrapped_dek bytea not null check (octet_length(wrapped_dek) = 48),
  dek_iv bytea not null check (octet_length(dek_iv) = 12),
  -- HMAC-SHA256(prova da senha mestra, parte do servidor): quem tem só o banco não consegue testar senhas.
  verifier bytea not null check (octet_length(verifier) = 32),
  secret_id uuid not null,
  max_attempts integer not null default 5 check (max_attempts between 3 and 10),
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger vault_meta_set_updated_at before update on public.vault_meta
  for each row execute function private.set_updated_at();

-- --------------------------------------------------------------- vault_items
-- Um item por acesso: só IV e texto cifrado ({senha, notas} em JSON). O banco não consegue ler o conteúdo.
create table public.vault_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.vault_meta (organization_id) on delete cascade,
  access_id uuid not null,
  iv bytea not null check (octet_length(iv) = 12),
  ciphertext bytea not null check (octet_length(ciphertext) between 17 and 20000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, access_id),
  foreign key (organization_id, access_id) references public.access_entries (organization_id, id) on delete cascade
);

create trigger vault_items_set_updated_at before update on public.vault_items
  for each row execute function private.set_updated_at();

-- ------------------------------------------------------------------ grants
revoke all on public.vault_meta, public.vault_items from public, anon, authenticated;
-- O cliente lê só o que precisa para derivar a chave; `verifier` e `secret_id` nunca saem. Escrita só por RPC.
grant select (organization_id, salt, kdf_iterations, wrapped_dek, dek_iv, max_attempts, failed_attempts,
              locked_until, created_at)
  on public.vault_meta to authenticated;
grant select on public.vault_items to authenticated;
grant insert (organization_id, access_id, iv, ciphertext) on public.vault_items to authenticated;
grant update (iv, ciphertext) on public.vault_items to authenticated;
grant delete on public.vault_items to authenticated;

alter table public.vault_meta enable row level security;
alter table public.vault_items enable row level security;

create policy vault_meta_select_owner on public.vault_meta
  for select to authenticated using (private.is_active_owner(organization_id));

create policy vault_items_select_owner on public.vault_items
  for select to authenticated using (private.is_active_owner(organization_id));
create policy vault_items_insert_owner on public.vault_items
  for insert to authenticated with check (private.is_active_owner(organization_id));
create policy vault_items_update_owner on public.vault_items
  for update to authenticated
  using (private.is_active_owner(organization_id))
  with check (private.is_active_owner(organization_id));
create policy vault_items_delete_owner on public.vault_items
  for delete to authenticated using (private.is_active_owner(organization_id));

do $$
declare
  t text;
begin
  foreach t in array array['vault_meta', 'vault_items']
  loop
    execute format(
      'create policy mfa_required on public.%I as restrictive for all to authenticated '
      'using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()))', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- funções
-- Apaga o cofre: a parte do servidor (Vault), a chave embrulhada e, em cascata, os itens.
create function private.vault_wipe(p_org uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret uuid;
begin
  select m.secret_id into v_secret from public.vault_meta m where m.organization_id = p_org;
  if v_secret is not null then
    delete from vault.secrets where id = v_secret;
  end if;
  delete from public.vault_meta where organization_id = p_org;
end;
$$;

-- Só o dono ativo, com MFA satisfeito (mesma regra das tabelas; a função ignora a RLS, então confere aqui).
create function private.vault_guard(p_org uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (private.is_active_owner(p_org) and private.mfa_satisfied()) then
    raise exception 'sem permissão para o cofre' using errcode = '42501';
  end if;
end;
$$;

-- Confere a prova da senha mestra e conta as tentativas. Devolve a situação em vez de lançar erro (um erro
-- desfaria a contagem). status: ok | wrong | locked | destroyed | missing.
create function private.vault_check(p_org uuid, p_proof bytea)
returns table (status text, share bytea, attempts_left integer, retry_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.vault_meta;
  v_share bytea;
  v_failed integer;
begin
  select * into m from public.vault_meta where organization_id = p_org for update;
  if not found then
    return query select 'missing'::text, null::bytea, null::integer, null::timestamptz;
    return;
  end if;

  if m.locked_until is not null and m.locked_until > now() then
    return query select 'locked'::text, null::bytea, m.max_attempts - m.failed_attempts, m.locked_until;
    return;
  end if;

  select decode(s.decrypted_secret, 'base64') into v_share from vault.decrypted_secrets s where s.id = m.secret_id;
  if v_share is null then
    -- Parte do servidor ausente (ex.: banco restaurado de backup): o cofre não abre mais.
    return query select 'missing'::text, null::bytea, null::integer, null::timestamptz;
    return;
  end if;

  if p_proof is not null and octet_length(p_proof) = 32 and extensions.hmac(p_proof, v_share, 'sha256') = m.verifier then
    update public.vault_meta set failed_attempts = 0, locked_until = null where organization_id = p_org;
    return query select 'ok'::text, v_share, m.max_attempts, null::timestamptz;
    return;
  end if;

  v_failed := m.failed_attempts + 1;
  if v_failed >= m.max_attempts then
    perform private.vault_wipe(p_org);
    return query select 'destroyed'::text, null::bytea, 0, null::timestamptz;
    return;
  end if;

  update public.vault_meta
     set failed_attempts = v_failed,
         locked_until = case when v_failed >= 3 then now() + interval '15 minutes' else null end
   where organization_id = p_org;
  return query
    select 'wrong'::text, null::bytea, m.max_attempts - v_failed,
           case when v_failed >= 3 then now() + interval '15 minutes' else null end;
end;
$$;

revoke all on function private.vault_wipe(uuid) from public, anon, authenticated;
revoke all on function private.vault_guard(uuid) from public, anon, authenticated;
revoke all on function private.vault_check(uuid, bytea) from public, anon, authenticated;

-- As quatro operações do cofre. A lógica privilegiada fica em `private` (regra do projeto: SECURITY DEFINER só
-- lá); as funções de `public` são wrappers SECURITY INVOKER, o que a API expõe.

-- Cria o cofre. Tudo é gerado no navegador: sal, chave embrulhada, prova e parte do servidor.
create function private.vault_setup(
  p_organization uuid,
  p_salt bytea,
  p_iterations integer,
  p_proof bytea,
  p_share bytea,
  p_wrapped_dek bytea,
  p_dek_iv bytea,
  p_max_attempts integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret uuid;
begin
  perform private.vault_guard(p_organization);
  if p_proof is null or octet_length(p_proof) <> 32 or p_share is null or octet_length(p_share) <> 32 then
    raise exception 'parâmetros inválidos' using errcode = '22023';
  end if;
  if exists (select 1 from public.vault_meta where organization_id = p_organization) then
    raise exception 'o cofre já existe' using errcode = '23505';
  end if;
  v_secret := vault.create_secret(encode(p_share, 'base64'), 'cofre-' || p_organization::text,
                                  'Parte da chave do cofre guardada no servidor');
  insert into public.vault_meta (organization_id, salt, kdf_iterations, wrapped_dek, dek_iv, verifier, secret_id, max_attempts)
  values (p_organization, p_salt, p_iterations, p_wrapped_dek, p_dek_iv,
          extensions.hmac(p_proof, p_share, 'sha256'), v_secret, p_max_attempts);
end;
$$;

-- Abre o cofre: confere a prova e entrega a parte do servidor.
create function private.vault_unlock(p_organization uuid, p_proof bytea)
returns table (status text, share bytea, attempts_left integer, retry_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.vault_guard(p_organization);
  return query select * from private.vault_check(p_organization, p_proof);
end;
$$;

-- Troca a senha mestra: exige a prova da senha atual (conta tentativas) e regrava sal, chave embrulhada e
-- verificador; a parte do servidor e os itens continuam os mesmos (a DEK não muda).
create function private.vault_rekey(
  p_organization uuid,
  p_old_proof bytea,
  p_new_proof bytea,
  p_salt bytea,
  p_iterations integer,
  p_wrapped_dek bytea,
  p_dek_iv bytea
)
returns table (status text, attempts_left integer, retry_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  c record;
begin
  perform private.vault_guard(p_organization);
  if p_new_proof is null or octet_length(p_new_proof) <> 32 then
    raise exception 'parâmetros inválidos' using errcode = '22023';
  end if;
  select * into c from private.vault_check(p_organization, p_old_proof);
  if c.status = 'ok' then
    update public.vault_meta
       set salt = p_salt, kdf_iterations = p_iterations, wrapped_dek = p_wrapped_dek, dek_iv = p_dek_iv,
           verifier = extensions.hmac(p_new_proof, c.share, 'sha256')
     where organization_id = p_organization;
  end if;
  return query select c.status, c.attempts_left, c.retry_at;
end;
$$;

-- Destrói o cofre e tudo que há dentro (a pedido do dono).
create function private.vault_destroy(p_organization uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.vault_guard(p_organization);
  perform private.vault_wipe(p_organization);
end;
$$;

revoke all on function private.vault_setup(uuid, bytea, integer, bytea, bytea, bytea, bytea, integer) from public, anon;
revoke all on function private.vault_unlock(uuid, bytea) from public, anon;
revoke all on function private.vault_rekey(uuid, bytea, bytea, bytea, integer, bytea, bytea) from public, anon;
revoke all on function private.vault_destroy(uuid) from public, anon;
grant execute on function private.vault_setup(uuid, bytea, integer, bytea, bytea, bytea, bytea, integer) to authenticated;
grant execute on function private.vault_unlock(uuid, bytea) to authenticated;
grant execute on function private.vault_rekey(uuid, bytea, bytea, bytea, integer, bytea, bytea) to authenticated;
grant execute on function private.vault_destroy(uuid) to authenticated;

create function public.vault_setup(
  p_organization uuid, p_salt bytea, p_iterations integer, p_proof bytea, p_share bytea,
  p_wrapped_dek bytea, p_dek_iv bytea, p_max_attempts integer default 5
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.vault_setup(p_organization, p_salt, p_iterations, p_proof, p_share, p_wrapped_dek, p_dek_iv, p_max_attempts);
$$;

create function public.vault_unlock(p_organization uuid, p_proof bytea)
returns table (status text, share bytea, attempts_left integer, retry_at timestamptz)
language sql
security invoker
set search_path = ''
as $$
  select * from private.vault_unlock(p_organization, p_proof);
$$;

create function public.vault_rekey(
  p_organization uuid, p_old_proof bytea, p_new_proof bytea, p_salt bytea, p_iterations integer,
  p_wrapped_dek bytea, p_dek_iv bytea
)
returns table (status text, attempts_left integer, retry_at timestamptz)
language sql
security invoker
set search_path = ''
as $$
  select * from private.vault_rekey(p_organization, p_old_proof, p_new_proof, p_salt, p_iterations, p_wrapped_dek, p_dek_iv);
$$;

create function public.vault_destroy(p_organization uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.vault_destroy(p_organization);
$$;

revoke all on function public.vault_setup(uuid, bytea, integer, bytea, bytea, bytea, bytea, integer) from public, anon;
revoke all on function public.vault_unlock(uuid, bytea) from public, anon;
revoke all on function public.vault_rekey(uuid, bytea, bytea, bytea, integer, bytea, bytea) from public, anon;
revoke all on function public.vault_destroy(uuid) from public, anon;
grant execute on function public.vault_setup(uuid, bytea, integer, bytea, bytea, bytea, bytea, integer) to authenticated;
grant execute on function public.vault_unlock(uuid, bytea) to authenticated;
grant execute on function public.vault_rekey(uuid, bytea, bytea, bytea, integer, bytea, bytea) to authenticated;
grant execute on function public.vault_destroy(uuid) to authenticated;

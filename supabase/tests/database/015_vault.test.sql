-- Fase 8.1: cofre de senhas (parte do servidor, tentativas, bloqueio, destruição, MFA e isolamento).
begin;
create extension if not exists pgtap with schema extensions;
select plan(32);

create function public.t_act_as(p_uid uuid, p_aal text default null) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_strip_nulls(json_build_object('sub', p_uid, 'role', 'authenticated', 'aal', p_aal))::text, true);
  set local role authenticated;
end $$;

insert into auth.users (id, email, aud, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@test.local', 'authenticated', 'authenticated'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@test.local', 'authenticated', 'authenticated');

create temp table ctx as
select (select id from public.organizations where created_by = 'aaaaaaaa-0000-0000-0000-000000000001') as org_a,
       (select id from public.organizations where created_by = 'bbbbbbbb-0000-0000-0000-000000000002') as org_b;
grant select on ctx to authenticated;

-- um acesso para ligar ao item
insert into public.access_entries (organization_id, name) select org_a, 'Painel' from ctx;
create temp table ids as select id as access_id from public.access_entries where name = 'Painel';
grant select on ids to authenticated;

-- ---------------------------------------------------------------- criação
select public.t_act_as('aaaaaaaa-0000-0000-0000-000000000001', 'aal1');
select lives_ok($$select public.vault_setup((select org_a from ctx), decode(repeat('11', 16), 'hex'), 600000,
  decode(repeat('aa', 32), 'hex'), decode(repeat('bb', 32), 'hex'), decode(repeat('cc', 48), 'hex'),
  decode(repeat('dd', 12), 'hex'))$$, 'owner cria o cofre');
select throws_ok($$select public.vault_setup((select org_a from ctx), decode(repeat('11', 16), 'hex'), 600000,
  decode(repeat('aa', 32), 'hex'), decode(repeat('bb', 32), 'hex'), decode(repeat('cc', 48), 'hex'),
  decode(repeat('dd', 12), 'hex'))$$, '23505', null, 'só um cofre por organização');
select is((select count(*)::int from public.vault_meta), 1, 'owner enxerga os parâmetros do cofre');
select throws_ok($$select verifier from public.vault_meta$$, '42501', null, 'o verificador nunca é legível pelo cliente');
select throws_ok($$select secret_id from public.vault_meta$$, '42501', null, 'o id do segredo do servidor não é legível');
select throws_ok($$insert into public.vault_meta (organization_id, salt, kdf_iterations, wrapped_dek, dek_iv, verifier, secret_id)
  select org_a, decode(repeat('11', 16), 'hex'), 600000, decode(repeat('cc', 48), 'hex'), decode(repeat('dd', 12), 'hex'),
         decode(repeat('ee', 32), 'hex'), gen_random_uuid() from ctx$$, '42501', null, 'cliente não escreve em vault_meta direto');
reset role;

select is((select count(*)::int from vault.secrets where name = 'cofre-' || (select org_a from ctx)::text), 1,
  'a parte do servidor foi para o Vault');
select isnt((select verifier from public.vault_meta), decode(repeat('aa', 32), 'hex'),
  'o verificador não é a prova pura (é HMAC com a parte do servidor)');

-- ---------------------------------------------------------------- abrir e tentativas
select public.t_act_as('aaaaaaaa-0000-0000-0000-000000000001', 'aal1');
select is((select status from public.vault_unlock((select org_a from ctx), decode(repeat('aa', 32), 'hex'))), 'ok',
  'prova correta abre');
select is((select share from public.vault_unlock((select org_a from ctx), decode(repeat('aa', 32), 'hex'))),
  decode(repeat('bb', 32), 'hex'), 'devolve a parte do servidor');
select is((select attempts_left from public.vault_unlock((select org_a from ctx), decode(repeat('00', 32), 'hex'))), 4,
  '1º erro: restam 4');
select is((select attempts_left from public.vault_unlock((select org_a from ctx), decode(repeat('00', 32), 'hex'))), 3,
  '2º erro: restam 3');
select is((select retry_at is not null from public.vault_unlock((select org_a from ctx), decode(repeat('00', 32), 'hex'))), true,
  '3º erro seguido bloqueia por 15 minutos');
select is((select status from public.vault_unlock((select org_a from ctx), decode(repeat('aa', 32), 'hex'))), 'locked',
  'bloqueado: nem a prova correta abre');
select is((select share from public.vault_unlock((select org_a from ctx), decode(repeat('aa', 32), 'hex'))), null,
  'bloqueado: a parte do servidor não sai');
reset role;

-- passa o bloqueio (relógio): a contagem continua em 3
update public.vault_meta set locked_until = now() - interval '1 minute';
select public.t_act_as('aaaaaaaa-0000-0000-0000-000000000001', 'aal1');
select is((select status from public.vault_unlock((select org_a from ctx), decode(repeat('aa', 32), 'hex'))), 'ok',
  'depois do bloqueio, a prova correta abre');
select is((select failed_attempts from public.vault_meta), 0, 'acerto zera as tentativas erradas');
reset role;

-- ---------------------------------------------------------------- itens
select public.t_act_as('aaaaaaaa-0000-0000-0000-000000000001', 'aal1');
select lives_ok($$insert into public.vault_items (organization_id, access_id, iv, ciphertext)
  select org_a, (select access_id from ids), decode(repeat('01', 12), 'hex'), decode(repeat('02', 40), 'hex') from ctx$$,
  'owner guarda um item cifrado');
select throws_ok($$insert into public.vault_items (organization_id, access_id, iv, ciphertext)
  select org_a, (select access_id from ids), decode(repeat('01', 12), 'hex'), decode(repeat('02', 40), 'hex') from ctx$$,
  '23505', null, 'um item por acesso');
select lives_ok($$update public.vault_items set ciphertext = decode(repeat('03', 40), 'hex')$$, 'owner atualiza o texto cifrado');
reset role;

select public.t_act_as('bbbbbbbb-0000-0000-0000-000000000002', 'aal1');
select is((select count(*)::int from public.vault_items), 0, 'B não enxerga itens de A');
select is((select count(*)::int from public.vault_meta), 0, 'B não enxerga o cofre de A');
select throws_ok($$select * from public.vault_unlock((select org_a from ctx), decode(repeat('aa', 32), 'hex'))$$,
  '42501', null, 'B não abre o cofre de A');
select throws_ok($$select public.vault_destroy((select org_a from ctx))$$, '42501', null, 'B não destrói o cofre de A');
select throws_ok($$select public.vault_setup((select org_a from ctx), decode(repeat('11', 16), 'hex'), 600000,
  decode(repeat('aa', 32), 'hex'), decode(repeat('bb', 32), 'hex'), decode(repeat('cc', 48), 'hex'),
  decode(repeat('dd', 12), 'hex'))$$, '42501', null, 'B não cria cofre na organização de A');
reset role;

-- ---------------------------------------------------------------- troca da senha mestra
select public.t_act_as('aaaaaaaa-0000-0000-0000-000000000001', 'aal1');
select is((select status from public.vault_rekey((select org_a from ctx), decode(repeat('00', 32), 'hex'),
  decode(repeat('a2', 32), 'hex'), decode(repeat('12', 16), 'hex'), 600000, decode(repeat('c2', 48), 'hex'),
  decode(repeat('d2', 12), 'hex'))), 'wrong', 'troca com a prova atual errada é recusada (e conta)');
select is((select status from public.vault_rekey((select org_a from ctx), decode(repeat('aa', 32), 'hex'),
  decode(repeat('a2', 32), 'hex'), decode(repeat('12', 16), 'hex'), 600000, decode(repeat('c2', 48), 'hex'),
  decode(repeat('d2', 12), 'hex'))), 'ok', 'troca com a prova atual correta');
select is((select status from public.vault_unlock((select org_a from ctx), decode(repeat('a2', 32), 'hex'))), 'ok',
  'a prova nova abre');
reset role;

-- ---------------------------------------------------------------- destruição por erros seguidos
select public.t_act_as('aaaaaaaa-0000-0000-0000-000000000001', 'aal1');
select public.vault_unlock((select org_a from ctx), decode(repeat('00', 32), 'hex'));
reset role;
update public.vault_meta set failed_attempts = 4, locked_until = null;
select public.t_act_as('aaaaaaaa-0000-0000-0000-000000000001', 'aal1');
select is((select status from public.vault_unlock((select org_a from ctx), decode(repeat('00', 32), 'hex'))), 'destroyed',
  'o 5º erro seguido destrói o cofre');
select is((select status from public.vault_unlock((select org_a from ctx), decode(repeat('a2', 32), 'hex'))), 'missing',
  'depois de destruído, nem a prova correta abre');
reset role;
select is((select count(*)::int from vault.secrets where name = 'cofre-' || (select org_a from ctx)::text), 0,
  'destruído: a parte do servidor foi apagada do Vault');
select is((select count(*)::int from public.vault_items) + (select count(*)::int from public.vault_meta), 0,
  'destruído: itens e chave embrulhada foram apagados');

select * from finish();
rollback;

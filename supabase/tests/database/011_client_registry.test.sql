-- D096: cadastro do cliente e contatos. Isolamento, escrita só do owner, um contato principal,
-- restrições de URL/e-mail e dados pessoais fora da trilha de atividade.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

create function public.t_rowcount(p_sql text) returns int language plpgsql as $$
declare n int; begin execute p_sql; get diagnostics n = row_count; return n; end $$;
create function public.t_act_as(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

insert into auth.users (id, email, aud, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@test.local', 'authenticated', 'authenticated'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@test.local', 'authenticated', 'authenticated'),
  ('cccccccc-0000-0000-0000-000000000003', 'c@test.local', 'authenticated', 'authenticated');

create temp table ctx as
select (select id from public.organizations where created_by = 'aaaaaaaa-0000-0000-0000-000000000001') as org_a,
       (select id from public.organizations where created_by = 'bbbbbbbb-0000-0000-0000-000000000002') as org_b,
       null::uuid as client_a, null::uuid as client_b;
grant select on ctx to authenticated;
insert into public.organization_members (organization_id, user_id, role)
  select org_a, 'cccccccc-0000-0000-0000-000000000003', 'member' from ctx;
insert into public.clients (organization_id, name) select org_a, 'Cliente A' from ctx;
insert into public.clients (organization_id, name) select org_b, 'Cliente B' from ctx;
update ctx set
  client_a = (select id from public.clients where organization_id = ctx.org_a and name = 'Cliente A'),
  client_b = (select id from public.clients where organization_id = ctx.org_b and name = 'Cliente B');

select public.t_act_as('aaaaaaaa-0000-0000-0000-000000000001');
select lives_ok($$update public.clients set legal_name = 'Acme Ltda', tax_id = '12.345.678/0001-95',
  billing_email = 'cobranca@acme.com', website = 'https://acme.com', address_line = 'Rua X, 10',
  address_city = 'São Paulo', address_state = 'SP', address_postal_code = '01000-000', source = 'Indicação'
  where id = (select client_a from ctx)$$, 'owner completa o cadastro do cliente');
select throws_ok($$update public.clients set website = 'javascript:alert(1)' where id = (select client_a from ctx)$$,
  '23514', null, 'site que não é http(s) é rejeitado');
select throws_ok($$update public.clients set billing_email = 'sem-arroba' where id = (select client_a from ctx)$$,
  '23514', null, 'e-mail de cobrança inválido é rejeitado');

select lives_ok($$insert into public.client_contacts (organization_id, client_id, name, role_title, email, is_primary)
  select org_a, client_a, 'Ana', 'Diretora', 'ana@acme.com', true from ctx$$, 'owner cria o contato principal');
select lives_ok($$insert into public.client_contacts (organization_id, client_id, name, whatsapp, is_primary)
  select org_a, client_a, 'Bruno', '+55 11 91234-5678', true from ctx$$, 'novo principal desmarca o anterior');
select is((select count(*)::int from public.client_contacts where is_primary), 1, 'só há um contato principal por cliente');
select is((select name from public.client_contacts where is_primary), 'Bruno', 'o principal é o último marcado');
select throws_ok($$insert into public.client_contacts (organization_id, client_id, name)
  select org_a, client_b, 'Cruzado' from ctx$$, '23503', null, 'FK composta: contato não aponta para cliente de B');
reset role;

-- Dados pessoais fora da trilha.
select is(
  (select count(*)::int from public.activity_logs
    where entity_type = 'client'
      and (changes ? 'tax_id' or changes ? 'billing_email' or changes ? 'address_line'
           or changes ? 'address_city' or changes ? 'address_postal_code')),
  0, 'documento, e-mail de cobrança e endereço ficam fora de activity_logs');

select public.t_act_as('bbbbbbbb-0000-0000-0000-000000000002');
select is((select count(*)::int from public.client_contacts), 0, 'B não enxerga contatos de A');
select is(public.t_rowcount($$delete from public.client_contacts$$), 0, 'B não apaga contatos de A');
reset role;

select public.t_act_as('cccccccc-0000-0000-0000-000000000003');
select is((select count(*)::int from public.client_contacts), 2, 'membro enxerga os contatos');
select throws_ok($$insert into public.client_contacts (organization_id, client_id, name)
  select org_a, client_a, 'Membro' from ctx$$, '42501', null, 'membro não cria contato');
reset role;

select public.t_act_as('aaaaaaaa-0000-0000-0000-000000000001');
select is(public.t_rowcount($$delete from public.client_contacts where name = 'Ana'$$), 1, 'owner remove contato');
reset role;

select * from finish();
rollback;

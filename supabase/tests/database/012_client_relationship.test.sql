-- D098: próximo contato, interações e documentos do cliente.
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
       null::uuid as client_a1, null::uuid as client_a2, null::uuid as contact_a1, null::uuid as project_b;
grant select on ctx to authenticated;
insert into public.organization_members (organization_id, user_id, role)
  select org_a, 'cccccccc-0000-0000-0000-000000000003', 'member' from ctx;
insert into public.clients (organization_id, name) select org_a, 'Cliente A1' from ctx;
insert into public.clients (organization_id, name) select org_a, 'Cliente A2' from ctx;
insert into public.projects (organization_id, name) select org_b, 'Projeto B' from ctx;
update ctx set
  client_a1 = (select id from public.clients where organization_id = ctx.org_a and name = 'Cliente A1'),
  client_a2 = (select id from public.clients where organization_id = ctx.org_a and name = 'Cliente A2'),
  project_b = (select id from public.projects where organization_id = ctx.org_b and name = 'Projeto B');
insert into public.client_contacts (organization_id, client_id, name)
  select org_a, client_a1, 'Ana' from ctx;
update ctx set contact_a1 = (select id from public.client_contacts where organization_id = ctx.org_a and name = 'Ana');

select public.t_act_as('aaaaaaaa-0000-0000-0000-000000000001');
select lives_ok($$update public.clients set next_contact_on = '2026-11-20', next_contact_note = 'Enviar proposta revisada'
  where id = (select client_a1 from ctx)$$, 'owner define o próximo contato');
select lives_ok($$insert into public.client_interactions (organization_id, client_id, contact_id, kind, summary)
  select org_a, client_a1, contact_a1, 'call', 'Alinhou escopo e prazo' from ctx$$, 'owner registra interação com contato');
select throws_ok($$insert into public.client_interactions (organization_id, client_id, contact_id, summary)
  select org_a, client_a2, contact_a1, 'Contato de outro cliente' from ctx$$, '23503', null,
  'o contato precisa pertencer ao mesmo cliente da interação');
select throws_ok($$insert into public.client_interactions (organization_id, client_id, summary)
  select org_a, client_a1, '   ' from ctx$$, '23514', null, 'resumo vazio é rejeitado');
select throws_ok($$insert into public.client_interactions (organization_id, client_id, kind, summary)
  select org_a, client_a1, 'sms', 'x' from ctx$$, '23514', null, 'tipo fora da lista é rejeitado');

select lives_ok($$insert into public.client_documents (organization_id, client_id, title, url, kind)
  select org_a, client_a1, 'Contrato assinado', 'https://drive.google.com/file/d/abc', 'contract' from ctx$$,
  'owner guarda link de documento');
select throws_ok($$insert into public.client_documents (organization_id, client_id, title, url)
  select org_a, client_a1, 'Mau', 'javascript:alert(1)' from ctx$$, '23514', null, 'link que não é http(s) é rejeitado');
select throws_ok($$insert into public.client_documents (organization_id, client_id, project_id, title, url)
  select org_a, client_a1, project_b, 'Cruzado', 'https://exemplo.com' from ctx$$, '23503', null,
  'FK composta: documento não aponta para projeto de B');

-- Remover o contato não apaga a interação: só desvincula.
select lives_ok($$delete from public.client_contacts where name = 'Ana'$$, 'owner remove o contato');
select is((select count(*)::int from public.client_interactions where contact_id is null and summary like 'Alinhou%'), 1,
  'a interação permanece, sem o contato');
reset role;

select public.t_act_as('bbbbbbbb-0000-0000-0000-000000000002');
select is((select count(*)::int from public.client_interactions) + (select count(*)::int from public.client_documents), 0,
  'B não enxerga interações nem documentos de A');
reset role;

select public.t_act_as('cccccccc-0000-0000-0000-000000000003');
select is((select count(*)::int from public.client_interactions), 1, 'membro enxerga as interações');
select throws_ok($$insert into public.client_interactions (organization_id, client_id, summary)
  select org_a, client_a1, 'Membro' from ctx$$, '42501', null, 'membro não registra interação');
reset role;

select public.t_act_as('aaaaaaaa-0000-0000-0000-000000000001');
select is(public.t_rowcount($$delete from public.client_documents$$), 1, 'owner remove documento');
reset role;

select * from finish();
rollback;

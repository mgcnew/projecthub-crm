-- Fase 7.3: sistemas, modelos de mensagem e sistema de interesse do lead.
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

create function public.t_act_as(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

insert into auth.users (id, email, aud, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@test.local', 'authenticated', 'authenticated'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@test.local', 'authenticated', 'authenticated');
create temp table ctx as
select (select id from public.organizations where created_by = 'aaaaaaaa-0000-0000-0000-000000000001') as org_a,
       (select id from public.organizations where created_by = 'bbbbbbbb-0000-0000-0000-000000000002') as org_b;
grant select on ctx to authenticated;

select public.t_act_as('aaaaaaaa-0000-0000-0000-000000000001');
select lives_ok($$insert into public.products (organization_id, name, value_proposition, demo_url)
  select org_a, 'Sistema de pedidos', 'Cardápio digital sem taxa por pedido', 'https://demo.exemplo.com' from ctx$$,
  'owner cadastra um sistema');
select throws_ok($$insert into public.products (organization_id, name) select org_a, 'sistema de PEDIDOS' from ctx$$,
  '23505', null, 'nome de sistema único por organização, sem diferença de caixa');
select throws_ok($$insert into public.products (organization_id, name, demo_url) select org_a, 'X', 'javascript:alert(1)' from ctx$$,
  '23514', null, 'a demonstração só aceita http(s)');
select throws_ok($$delete from public.products$$, '42501', null, 'sistemas não são apagados pelo cliente');

create temp table ids as select id as product_id from public.products where name = 'Sistema de pedidos';
grant select on ids to authenticated;

select lives_ok($$insert into public.message_templates (organization_id, product_id, name, channel, temperature, step, subject, body, openings, closings)
  select org_a, (select product_id from ids), 'Primeiro contato', 'email', 'cold', 1, 'Uma ideia para a {{empresa}}',
         'Vi {{gancho}}. Faz sentido conversar?', array['Oi, {{contato}}', 'Olá, {{contato}}'], array['Abraço', 'Até mais'] from ctx$$,
  'owner cria um modelo de e-mail');
select lives_ok($$insert into public.message_templates (organization_id, name, channel, temperature, step, body)
  select org_a, 'Zap morno', 'whatsapp', 'warm', 1, 'Oi {{contato}}, vi {{gancho}}. Posso te mandar um exemplo?' from ctx$$,
  'modelo de WhatsApp para lead morno');
select throws_ok($$insert into public.message_templates (organization_id, name, channel, temperature, step, body)
  select org_a, 'Zap frio', 'whatsapp', 'cold', 1, 'Oi' from ctx$$, '23514', null, 'WhatsApp não aceita modelo para lead frio (D105)');
select throws_ok($$insert into public.message_templates (organization_id, name, channel, step, body)
  select org_a, 'Zap sem público', 'whatsapp', 1, 'Oi' from ctx$$, '23514', null, 'WhatsApp exige morno ou quente');
select throws_ok($$insert into public.message_templates (organization_id, name, channel, step, body)
  select org_a, 'Email sem assunto', 'email', 1, 'Oi' from ctx$$, '23514', null, 'e-mail exige assunto');
select throws_ok($$insert into public.message_templates (organization_id, name, channel, temperature, step, subject, body)
  select org_a, 'Zap com assunto', 'whatsapp', 'hot', 1, 'assunto', 'Oi' from ctx$$, '23514', null, 'WhatsApp não tem assunto');
select throws_ok($$insert into public.message_templates (organization_id, name, channel, step, subject, body)
  select org_a, 'Passo 4', 'email', 4, 's', 'Oi' from ctx$$, '23514', null, 'só existem os passos 1 a 3');
select throws_ok($$insert into public.message_templates (organization_id, name, channel, step, subject, body, openings)
  select org_a, 'Abertura vazia', 'email', 1, 's', 'Oi', array['   '] from ctx$$, '23514', null, 'abertura em branco é recusada');
select throws_ok($$insert into public.message_templates (organization_id, name, channel, step, subject, body, closings)
  select org_a, 'Muitas', 'email', 1, 's', 'Oi', array_fill('x'::text, array[11]) from ctx$$, '23514', null, 'no máximo 10 variações');

-- sistema de interesse no lead
select lives_ok($$insert into public.leads (organization_id, company_name, source, product_id)
  select org_a, 'Padaria Sol', 'planilha', (select product_id from ids) from ctx$$, 'lead com sistema de interesse');
reset role;

-- B não vê nada de A e não liga lead dele ao sistema de A (FK composta)
select public.t_act_as('bbbbbbbb-0000-0000-0000-000000000002');
select is((select count(*)::int from public.products), 0, 'B não enxerga sistemas de A');
select is((select count(*)::int from public.message_templates), 0, 'B não enxerga modelos de A');
select throws_ok($$insert into public.leads (organization_id, company_name, source, product_id)
  select org_b, 'Lead de B', 'x', (select product_id from ids) from ctx$$, '23503', null, 'B não aponta lead para o sistema de A');
select throws_ok($$insert into public.products (organization_id, name) select org_a, 'Invasor' from ctx$$, '42501', null, 'B não cria sistema em A');
reset role;

select * from finish();
rollback;

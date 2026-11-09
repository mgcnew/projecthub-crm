-- Fase 7.4: fila de mensagens (regras de WhatsApp, supressão, transições, edição e isolamento).
begin;
create extension if not exists pgtap with schema extensions;
select plan(28);

create function public.t_act_as(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

insert into auth.users (id, email, aud, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@test.local', 'authenticated', 'authenticated'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@test.local', 'authenticated', 'authenticated');
create temp table ctx as
select (select id from public.organizations where created_by = 'aaaaaaaa-0000-0000-0000-000000000001') as org_a;
grant select on ctx to authenticated;

-- dados de A (como superusuário: sem RLS)
insert into public.leads (organization_id, company_name, source, email, phone, temperature) select org_a, 'Frio', 't', 'Frio@Ex.com', '+5511911111111', 'cold' from ctx;
insert into public.leads (organization_id, company_name, source, email, phone, temperature) select org_a, 'Morno', 't', 'morno@ex.com', '+5511922222222', 'warm' from ctx;
insert into public.leads (organization_id, company_name, source, email, temperature) select org_a, 'SemFone', 't', 'semfone@ex.com', 'hot' from ctx;
insert into public.leads (organization_id, company_name, source, email, temperature, opted_out_at) select org_a, 'Saiu', 't', 'saiu@ex.com', 'warm', now() from ctx;
insert into public.leads (organization_id, company_name, source, email, temperature) select org_a, 'Suprimido', 't', 'sup@ex.com', 'warm' from ctx;
insert into public.suppression_list (organization_id, channel, value, reason) select org_a, 'email', 'sup@ex.com', 'bounce' from ctx;
insert into public.message_templates (organization_id, name, channel, step, subject, body) select org_a, 'Modelo email', 'email', 1, 'Oi', 'Olá' from ctx;
create temp table ids as
select (select id from public.leads where company_name = 'Frio') as frio,
       (select id from public.leads where company_name = 'Morno') as morno,
       (select id from public.leads where company_name = 'SemFone') as semfone,
       (select id from public.leads where company_name = 'Saiu') as saiu,
       (select id from public.leads where company_name = 'Suprimido') as sup,
       (select id from public.message_templates where name = 'Modelo email') as tpl;
grant select on ids to authenticated;

select public.t_act_as('aaaaaaaa-0000-0000-0000-000000000001');
-- rascunho de e-mail: o destino vem do lead (minúsculo)
select lives_ok($$insert into public.outbound_messages (organization_id, lead_id, template_id, channel, subject, body)
  select org_a, (select frio from ids), (select tpl from ids), 'email', 'Oi', 'Olá, tudo bem?' from ctx$$, 'owner gera rascunho de e-mail para lead frio');
select is((select to_address from public.outbound_messages where lead_id = (select frio from ids)), 'frio@ex.com', 'destino = e-mail do lead, em minúsculo');
select is((select status from public.outbound_messages where lead_id = (select frio from ids)), 'draft', 'nasce como rascunho');
select throws_ok($$insert into public.outbound_messages (organization_id, lead_id, channel, subject, body, to_address)
  select org_a, (select morno from ids), 'email', 'x', 'y', 'outro@ex.com' from ctx$$, '42501', null, 'o cliente não escolhe o destino');
select throws_ok($$insert into public.outbound_messages (organization_id, lead_id, template_id, channel, subject, body)
  select org_a, (select frio from ids), (select tpl from ids), 'email', 'Oi', 'de novo' from ctx$$, '23505', null, 'mesmo lead e modelo não duplicam');

-- WhatsApp só para morno/quente, com telefone
select throws_ok($$insert into public.outbound_messages (organization_id, lead_id, channel, body)
  select org_a, (select frio from ids), 'whatsapp', 'Oi' from ctx$$, '23514', 'WhatsApp só para lead morno ou quente', 'WhatsApp para lead frio falha com mensagem clara (D105)');
select throws_ok($$insert into public.outbound_messages (organization_id, lead_id, channel, body)
  select org_a, (select semfone from ids), 'whatsapp', 'Oi' from ctx$$, '23514', null, 'WhatsApp exige telefone');
select lives_ok($$insert into public.outbound_messages (organization_id, lead_id, channel, body)
  select org_a, (select morno from ids), 'whatsapp', 'Oi, tudo bem?' from ctx$$, 'WhatsApp para lead morno com telefone');
select throws_ok($$insert into public.outbound_messages (organization_id, lead_id, channel, subject, body)
  select org_a, (select morno from ids), 'whatsapp', 'assunto', 'Oi' from ctx$$, '23514', null, 'WhatsApp não tem assunto');

-- supressão e "não contatar" não geram rascunho
select throws_ok($$insert into public.outbound_messages (organization_id, lead_id, channel, subject, body)
  select org_a, (select saiu from ids), 'email', 'x', 'y' from ctx$$, '23514', 'lead pediu para não ser contatado', 'lead "não contatar" não gera rascunho');
select throws_ok($$insert into public.outbound_messages (organization_id, lead_id, channel, subject, body)
  select org_a, (select sup from ids), 'email', 'x', 'y' from ctx$$, '23514', 'endereço na lista de supressão (nunca contatar)', 'endereço suprimido não gera rascunho');

-- transições: aprovar, editar, voltar, cancelar
select lives_ok($$update public.outbound_messages set status = 'approved' where lead_id = (select frio from ids)$$, 'aprova o rascunho');
select isnt((select approved_at from public.outbound_messages where lead_id = (select frio from ids)), null, 'aprovar registra a data');
select throws_ok($$update public.outbound_messages set body = 'mudou' where lead_id = (select frio from ids)$$, '23514', null, 'aprovada não se edita');
select throws_ok($$update public.outbound_messages set status = 'sent' where lead_id = (select frio from ids)$$, '23514', null, 'o cliente não marca "enviada"');
select throws_ok($$update public.outbound_messages set status = 'sending' where lead_id = (select frio from ids)$$, '23514', 'só o servidor marca enviando, enviada ou falhou', 'o cliente não marca "enviando"');
select throws_ok($$update public.outbound_messages set to_address = 'x@x.com'$$, '42501', null, 'o cliente não altera o destino');
select throws_ok($$delete from public.outbound_messages$$, '42501', null, 'mensagens não são apagadas pelo cliente');
select lives_ok($$update public.outbound_messages set status = 'draft' where lead_id = (select frio from ids)$$, 'aprovada volta para rascunho');
select is((select approved_at from public.outbound_messages where lead_id = (select frio from ids)), null, 'voltar a rascunho limpa a data de aprovação');
select lives_ok($$update public.outbound_messages set body = 'Olá, tudo certo?' where lead_id = (select frio from ids)$$, 'rascunho se edita');
select lives_ok($$update public.outbound_messages set status = 'cancelled' where lead_id = (select frio from ids)$$, 'rascunho pode ser cancelado');
select throws_ok($$update public.outbound_messages set status = 'approved' where lead_id = (select frio from ids)$$, '23514', null, 'cancelada não volta');
reset role;

-- a supressão entra depois do rascunho: a aprovação barra
insert into public.suppression_list (organization_id, channel, value, reason) select org_a, 'whatsapp', '+5511922222222', 'manual' from ctx;
select public.t_act_as('aaaaaaaa-0000-0000-0000-000000000001');
select throws_ok($$update public.outbound_messages set status = 'approved' where lead_id = (select morno from ids)$$, '23514', 'endereço na lista de supressão (nunca contatar)', 'supressão posterior barra a aprovação');
reset role;

-- servidor (sem usuário): enviando → enviada (limpa as credenciais da sessão de teste)
select set_config('request.jwt.claims', '', true);
delete from public.suppression_list where value = '+5511922222222';
update public.outbound_messages set status = 'approved' where lead_id = (select morno from ids);
select lives_ok($$update public.outbound_messages set status = 'sending' where lead_id = (select morno from ids)$$, 'servidor marca enviando');
select lives_ok($$update public.outbound_messages set status = 'sent', sent_at = now() where lead_id = (select morno from ids)$$, 'servidor marca enviada');

-- isolamento
select public.t_act_as('bbbbbbbb-0000-0000-0000-000000000002');
select is((select count(*)::int from public.outbound_messages), 0, 'B não enxerga a fila de A');
select throws_ok($$insert into public.outbound_messages (organization_id, lead_id, channel, subject, body)
  select org_a, (select frio from ids), 'email', 'x', 'y' from ctx$$, '42501', null, 'B não cria mensagem em A');
reset role;

select * from finish();
rollback;

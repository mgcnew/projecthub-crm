-- Fase 7.8: respostas, temperatura automática, palavras de saída e conversão em cliente.
begin;
create extension if not exists pgtap with schema extensions;
select plan(32);

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

insert into public.leads (organization_id, company_name, source, email, phone, temperature, stage, contact_name, website, city)
select org_a, n, 'planilha', e, ph, 'cold', 'contacted', c, 'https://ex.com', 'Santos' from ctx,
  (values ('Ana', 'Ana@Ex.com', '+5511911111111', 'Ana Souza'), ('Bia', 'bia@ex.com', '+5511922222222', null),
          ('Caio', 'caio@ex.com', null, 'Caio Lima'), ('Dani', 'dani@ex.com', null, null), ('Edu', 'edu@ex.com', null, 'Edu')) v(n, e, ph, c);
create temp table ids as
select (select id from public.leads where company_name = 'Ana') as ana, (select id from public.leads where company_name = 'Bia') as bia,
       (select id from public.leads where company_name = 'Caio') as caio, (select id from public.leads where company_name = 'Dani') as dani,
       (select id from public.leads where company_name = 'Edu') as edu;
grant select on ids to authenticated;

select public.t_act_as('aaaaaaaa-0000-0000-0000-000000000001');
-- resposta registrada à mão: remetente vem do lead; etapa e temperatura reagem
select lives_ok($$insert into public.inbound_messages (organization_id, lead_id, channel, body)
  select org_a, (select ana from ids), 'email', 'Oi! Tenho interesse, pode me ligar?' from ctx$$, 'owner registra uma resposta');
select is((select from_address from public.inbound_messages where lead_id = (select ana from ids)), 'ana@ex.com', 'remetente = e-mail do lead, em minúsculo');
select is((select stage from public.leads where id = (select ana from ids)), 'replied', 'lead contatado vira "respondeu"');
select is((select temperature from public.leads where id = (select ana from ids)), 'warm', 'respondeu → frio sobe para morno');
select is((select read_at from public.inbound_messages where lead_id = (select ana from ids)), null, 'a resposta nasce como nova (não lida)');
select throws_ok($$insert into public.inbound_messages (organization_id, channel, body, from_address)
  select org_a, 'email', 'x', 'a@b.com' from ctx$$, '42501', null, 'o cliente não escolhe o remetente');
select throws_ok($$insert into public.inbound_messages (organization_id, channel, body) select org_a, 'email', 'sem lead' from ctx$$,
  '23514', null, 'sem lead nem endereço a resposta é recusada');
select lives_ok($$update public.inbound_messages set read_at = now() where lead_id = (select ana from ids)$$, 'marca como lida');
select throws_ok($$update public.inbound_messages set body = 'alterada'$$, '42501', null, 'o texto da resposta não é editável');
select throws_ok($$delete from public.inbound_messages$$, '42501', null, 'respostas não são apagadas pelo cliente');

-- palavra de saída
select lives_ok($$insert into public.inbound_messages (organization_id, lead_id, channel, body)
  select org_a, (select bia from ids), 'whatsapp', 'SAIR!' from ctx$$, 'resposta "SAIR"');
select isnt((select opted_out_at from public.leads where id = (select bia from ids)), null, '"SAIR" marca o lead como não contatar');
select is((select count(*)::int from public.suppression_list where value = 'bia@ex.com'), 1, 'e o endereço entra na lista de supressão');

-- temperatura automática pela etapa
select lives_ok($$update public.leads set stage = 'meeting' where id = (select caio from ids)$$, 'lead vai para "reunião"');
select is((select temperature from public.leads where id = (select caio from ids)), 'hot', 'reunião → quente');
select lives_ok($$update public.leads set stage = 'proposal' where id = (select dani from ids)$$, 'outro lead vai para "proposta"');
select is((select temperature from public.leads where id = (select dani from ids)), 'hot', 'proposta → quente');
select lives_ok($$update public.leads set stage = 'contacted' where id = (select caio from ids)$$, 'volta uma etapa');
select is((select temperature from public.leads where id = (select caio from ids)), 'hot', 'a temperatura nunca esfria sozinha');
reset role;

-- casamento por endereço (servidor, ex.: webhook)
insert into public.inbound_messages (organization_id, channel, body, from_address, provider_message_id)
select org_a, 'email', 'resposta pelo webhook', ' ANA@ex.com ', 'msg-1' from ctx;
select is((select lead_id from public.inbound_messages where provider_message_id = 'msg-1'), (select ana from ids), 'o webhook casa a resposta com o lead pelo e-mail');
insert into public.inbound_messages (organization_id, channel, body, from_address) select org_a, 'email', 'desconhecido', 'quem@ninguem.com' from ctx;
select is((select count(*)::int from public.inbound_messages where lead_id is null), 1, 'remetente desconhecido fica sem lead');
select throws_ok($$insert into public.inbound_messages (organization_id, channel, body, from_address, provider_message_id)
  select org_a, 'email', 'duplicada', 'x@y.com', 'msg-1' from ctx$$, '23505', null, 'a mesma mensagem do provedor não entra duas vezes');

-- conversão em cliente
select public.t_act_as('aaaaaaaa-0000-0000-0000-000000000001');
select lives_ok($$select public.convert_lead((select ana from ids), null, 'Sistema de pedidos')$$, 'converte o lead em cliente (com projeto)');
select is((select count(*)::int from public.clients where name = 'Ana'), 1, 'cliente criado com o nome da empresa');
select is((select count(*)::int from public.client_contacts k join public.clients c on c.id = k.client_id where c.name = 'Ana' and k.name = 'Ana Souza' and k.is_primary), 1, 'contato principal criado');
select is((select count(*)::int from public.projects p join public.clients c on c.id = p.client_id where c.name = 'Ana' and p.name = 'Sistema de pedidos'), 1, 'projeto criado');
select is((select stage || ':' || (converted_client_id is not null)::text from public.leads where id = (select ana from ids)), 'won:true', 'lead fica ganho e ligado ao cliente');
select throws_ok($$select public.convert_lead((select ana from ids))$$, '23505', null, 'não converte duas vezes');
select lives_ok($$select public.convert_lead((select edu from ids), (select id from public.clients where name = 'Ana'))$$, 'vincula a um cliente que já existe');
select is((select count(*)::int from public.clients), 1, 'vincular não cria cliente duplicado');
reset role;

select public.t_act_as('bbbbbbbb-0000-0000-0000-000000000002');
select is((select count(*)::int from public.inbound_messages), 0, 'B não enxerga respostas de A');
select throws_ok($$select public.convert_lead((select dani from ids))$$, '42501', null, 'B não converte lead de A');
reset role;

select * from finish();
rollback;

-- Fase 7.5/7.6: lote de envio (janela, dias úteis, limite diário, pausa, WhatsApp), resultado, saída e supressão.
begin;
create extension if not exists pgtap with schema extensions;
select plan(35);

create function public.t_act_as(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

insert into auth.users (id, email, aud, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@test.local', 'authenticated', 'authenticated');
create temp table ctx as
select (select id from public.organizations where created_by = 'aaaaaaaa-0000-0000-0000-000000000001') as org_a;
grant select on ctx to authenticated;

insert into public.outreach_settings (organization_id, email_daily_limit, whatsapp_daily_limit)
select org_a, 2, 5 from ctx;
insert into public.leads (organization_id, company_name, source, email, phone, temperature)
select org_a, n, 't', lower(n) || '@ex.com', ph, t from ctx,
  (values ('Ana', null, 'cold'), ('Bia', null, 'cold'), ('Caio', null, 'cold'), ('Dani', null, 'cold'),
          ('Zeca', '+5511911111111', 'warm'), ('Zoe', '+5511922222222', 'hot')) v(n, ph, t);
create temp table ids as
select (select id from public.leads where company_name = 'Ana') as ana, (select id from public.leads where company_name = 'Bia') as bia,
       (select id from public.leads where company_name = 'Caio') as caio, (select id from public.leads where company_name = 'Dani') as dani,
       (select id from public.leads where company_name = 'Zeca') as zeca, (select id from public.leads where company_name = 'Zoe') as zoe;
grant select on ids to authenticated;

-- rascunhos criados e aprovados pelo owner (como na tela)
select public.t_act_as('aaaaaaaa-0000-0000-0000-000000000001');
insert into public.outbound_messages (organization_id, lead_id, channel, subject, body)
select org_a, (select ana from ids), 'email', 'Oi Ana', 'Olá Ana' from ctx;
insert into public.outbound_messages (organization_id, lead_id, channel, subject, body)
select org_a, (select bia from ids), 'email', 'Oi Bia', 'Olá Bia' from ctx;
insert into public.outbound_messages (organization_id, lead_id, channel, subject, body)
select org_a, (select caio from ids), 'email', 'Oi Caio', 'Olá Caio' from ctx;
insert into public.outbound_messages (organization_id, lead_id, channel, body)
select org_a, (select zeca from ids), 'whatsapp', 'Oi Zeca' from ctx;
insert into public.outbound_messages (organization_id, lead_id, channel, body)
select org_a, (select zoe from ids), 'whatsapp', 'Oi Zoe' from ctx;
update public.outbound_messages set status = 'approved' where lead_id in (select ana from ids union select bia from ids union select caio from ids union select zeca from ids union select zoe from ids);
-- o usuário comum não chama as funções do envio
select throws_ok($$select * from public.outbox_claim('email')$$, '42501', null, 'o cliente não chama o lote de envio');
select throws_ok($$select private.claim_outbox('email')$$, '42501', null, 'nem a função privilegiada');
reset role;
select set_config('request.jwt.claims', '', true);
-- ordem de envio previsível: Ana, Bia, Caio (e-mail) e Zeca, Zoe (WhatsApp)
update public.outbound_messages set created_at = '2026-11-01 00:00:00+00'::timestamptz
  + (case (select company_name from public.leads l where l.id = lead_id) when 'Ana' then 1 when 'Bia' then 2 when 'Caio' then 3 when 'Zeca' then 1 else 2 end) * interval '1 minute';

-- terça 10:00 (America/Sao_Paulo) = 13:00 UTC
select is((select count(*)::int from private.claim_outbox('email', '2026-11-10 02:00:00+00', 20)), 0, 'fora da janela (23h): nada sai');
select is((select count(*)::int from private.claim_outbox('email', '2026-11-14 13:00:00+00', 20)), 0, 'sábado (só dias úteis): nada sai');
update public.outreach_settings set paused = true;
select is((select count(*)::int from private.claim_outbox('email', '2026-11-10 13:00:00+00', 20)), 0, 'pausado: nada sai');
update public.outreach_settings set paused = false;

-- limite diário de e-mail = 2 (3 aprovadas)
select is((select count(*)::int from private.claim_outbox('email', '2026-11-10 13:00:00+00', 20)), 2, 'respeita o limite diário (2 de 3)');
select is((select count(*)::int from public.outbound_messages where status = 'sending' and channel = 'email'), 2, 'as pegas ficam "enviando"');
select is((select attempts from public.outbound_messages where lead_id = (select ana from ids)), 1, 'a tentativa é contada');
select is((select count(*)::int from private.claim_outbox('email', '2026-11-10 14:00:00+00', 20)), 0, 'no mesmo dia, o limite já foi usado');
select is((select count(*)::int from private.claim_outbox('email', '2026-11-11 13:00:00+00', 20)), 1, 'no dia seguinte a que sobrou sai');

-- resultado do envio
select lives_ok($$select private.finish_outbox((select id from public.outbound_messages where lead_id = (select ana from ids)), true, 'fake', 'msg-ana', null, false, '2026-11-10 13:00:01+00')$$, 'marca enviada');
select is((select status from public.outbound_messages where lead_id = (select ana from ids)), 'sent', 'status enviada');
select is((select provider_message_id from public.outbound_messages where lead_id = (select ana from ids)), 'msg-ana', 'guarda o id do provedor');
select is((select stage from public.leads where id = (select ana from ids)), 'contacted', 'lead novo vira "contatado"');
select lives_ok($$select private.finish_outbox((select id from public.outbound_messages where lead_id = (select bia from ids)), false, 'fake', null, 'timeout', true, '2026-11-10 13:00:02+00')$$, 'falha com nova tentativa');
select is((select status from public.outbound_messages where lead_id = (select bia from ids)), 'approved', 'volta para aprovada (1ª tentativa)');
select ok((select scheduled_for from public.outbound_messages where lead_id = (select bia from ids)) = '2026-11-10 13:05:02+00', 'espera 5 min × tentativa');
select is((select count(*)::int from private.claim_outbox('email', '2026-11-12 13:00:00+00', 20)), 1, 'a nova tentativa sai depois da espera');

-- terceira falha: vira "falhou"
update public.outbound_messages set attempts = 3 where lead_id = (select bia from ids);
select lives_ok($$select private.finish_outbox((select id from public.outbound_messages where lead_id = (select bia from ids)), false, 'fake', null, 'erro final', true)$$, 'falha na 3ª tentativa');
select is((select status from public.outbound_messages where lead_id = (select bia from ids)), 'failed', 'depois de 3 tentativas fica "falhou"');

-- aprovada, mas o lead saiu antes do envio: cancela e não envia
select public.t_act_as('aaaaaaaa-0000-0000-0000-000000000001');
insert into public.outbound_messages (organization_id, lead_id, channel, subject, body)
select org_a, (select dani from ids), 'email', 'Oi Dani', 'Olá Dani' from ctx;
update public.outbound_messages set status = 'approved' where lead_id = (select dani from ids);
update public.leads set opted_out_at = now() where id = (select dani from ids);
reset role;
select set_config('request.jwt.claims', '', true);
update public.outreach_settings set email_daily_limit = 50;
select is((select count(*)::int from private.claim_outbox('email', '2026-11-13 13:00:00+00', 20) c where c.lead_id = (select dani from ids)), 0, 'lead que saiu depois da aprovação não é enviado');
select is((select status from public.outbound_messages where lead_id = (select dani from ids)), 'cancelled', 'a mensagem é cancelada');

-- WhatsApp: só com conexão aberta, 1 por rodada, intervalo aleatório
select is((select count(*)::int from private.claim_outbox('whatsapp', '2026-11-10 13:00:00+00', 20)), 0, 'sem conexão aberta, o WhatsApp não sai');
select lives_ok($$select private.set_whatsapp_state((select org_a from ctx), 'open')$$, 'webhook marca a conexão aberta');
select is((select count(*)::int from private.claim_outbox('whatsapp', '2026-11-10 13:00:00+00', 20)), 1, 'com a conexão aberta sai 1 por rodada');
select lives_ok($$select private.finish_outbox((select id from public.outbound_messages where lead_id = (select zeca from ids)), true, 'fake', 'w-1', null, false, '2026-11-10 13:00:00+00')$$, 'WhatsApp enviado');
select ok((select whatsapp_next_at from public.outreach_settings) between '2026-11-10 13:01:00+00' and '2026-11-10 13:04:00+00', 'próximo WhatsApp só entre 60 e 240 s depois');
select is((select count(*)::int from private.claim_outbox('whatsapp', '2026-11-10 13:00:30+00', 20)), 0, 'antes do intervalo não sai outro');
select is((select count(*)::int from private.claim_outbox('whatsapp', '2026-11-10 13:05:00+00', 20)), 1, 'depois do intervalo sai o seguinte');

-- saída e supressão
select public.t_act_as('aaaaaaaa-0000-0000-0000-000000000001');
insert into public.outbound_messages (organization_id, lead_id, channel, subject, body)
select org_a, (select caio from ids), 'email', 'Pendente', 'rascunho pendente do Caio' from ctx;
reset role;
select set_config('request.jwt.claims', '', true);
select lives_ok($$select private.unsubscribe_lead((select org_a from ctx), (select caio from ids))$$, 'link de descadastro');
select isnt((select opted_out_at from public.leads where id = (select caio from ids)), null, 'lead vira "não contatar"');
select is((select count(*)::int from public.suppression_list where value = 'caio@ex.com'), 1, 'e entra na lista de supressão');
select is((select status from public.outbound_messages where lead_id = (select caio from ids) and body = 'rascunho pendente do Caio'), 'cancelled', 'as pendentes dele são canceladas (a que já estava em envio não é tocada)');
select lives_ok($$select private.suppress_address((select org_a from ctx), 'email', 'Bia@Ex.com', 'bounce')$$, 'bounce do provedor');
select is((select count(*)::int from public.suppression_list where value = 'bia@ex.com' and reason = 'bounce'), 1, 'endereço suprimido (minúsculo)');

select * from finish();
rollback;

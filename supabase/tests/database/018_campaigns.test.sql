-- Fase 7.7: campanhas e sequências (status, ordem dos passos, resposta/saída do lead, canal e isolamento).
begin;
create extension if not exists pgtap with schema extensions;
select plan(42);

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

insert into public.leads (organization_id, company_name, source, email, phone, temperature)
select org_a, n, 't', lower(n) || '@ex.com', ph, t from ctx,
  (values ('Ana', '+5511911111111', 'cold'), ('Bia', null, 'cold'), ('Caio', '+5511922222222', 'warm'),
          ('Fabio', null, 'cold'), ('Gus', null, 'cold'), ('Hugo', null, 'cold')) v(n, ph, t);
insert into public.leads (organization_id, company_name, source, email, temperature, opted_out_at)
select org_a, 'Eva', 't', 'eva@ex.com', 'cold', now() from ctx;
insert into public.message_templates (organization_id, name, channel, step, subject, body)
select org_a, 'E' || s, 'email', s, 'Assunto', 'Corpo ' || s from ctx, generate_series(1, 3) s;
insert into public.message_templates (organization_id, name, channel, temperature, step, body)
select org_a, 'Z1', 'whatsapp', 'warm', 1, 'Oi' from ctx;
create temp table ids as
select (select id from public.leads where company_name = 'Ana') as ana, (select id from public.leads where company_name = 'Bia') as bia,
       (select id from public.leads where company_name = 'Caio') as caio, (select id from public.leads where company_name = 'Eva') as eva,
       (select id from public.leads where company_name = 'Fabio') as fabio, (select id from public.leads where company_name = 'Gus') as gus,
       (select id from public.leads where company_name = 'Hugo') as hugo,
       (select id from public.message_templates where name = 'E1') as t1, (select id from public.message_templates where name = 'E2') as t2,
       (select id from public.message_templates where name = 'E3') as t3, (select id from public.message_templates where name = 'Z1') as z1;
grant select on ids to authenticated;

select public.t_act_as('aaaaaaaa-0000-0000-0000-000000000001');

-- ---------------------------------------------------------------- campanha
select lives_ok($$insert into public.campaigns (organization_id, name, channel, step1_template_id, step2_template_id, step3_template_id)
  select org_a, 'Camp e-mail', 'email', (select t1 from ids), (select t2 from ids), (select t3 from ids) from ctx$$, 'owner cria a campanha (D+3 e D+7 por padrão)');
select is((select followup_days from public.campaigns where name = 'Camp e-mail'), '{3,7}'::int[], 'lembretes padrão em D+3 e D+7');
select throws_ok($$insert into public.campaigns (organization_id, name, channel) select org_a, 'Zap sem público', 'whatsapp' from ctx$$,
  '23514', null, 'campanha de WhatsApp exige público morno ou quente (D105)');
select throws_ok($$insert into public.campaigns (organization_id, name, channel, followup_days) select org_a, 'Ordem', 'email', '{7,3}' from ctx$$,
  '23514', null, 'os lembretes seguem em ordem crescente');
select throws_ok($$insert into public.campaigns (organization_id, name, channel, followup_days, step3_template_id)
  select org_a, 'Um lembrete', 'email', '{3}', (select t3 from ids) from ctx$$, '23514', null, 'sem 2º lembrete não há modelo do passo 3');
select throws_ok($$insert into public.campaigns (organization_id, name, channel, step2_template_id)
  select org_a, 'Modelo trocado', 'email', (select t1 from ids) from ctx$$, '23514', null, 'o modelo do passo 2 precisa ser do passo 2');
select throws_ok($$insert into public.campaigns (organization_id, name, channel, step1_template_id)
  select org_a, 'Canal trocado', 'email', (select z1 from ids) from ctx$$, '23514', null, 'o modelo precisa ser do canal da campanha');
select throws_ok($$update public.campaigns set channel = 'whatsapp'$$, '42501', null, 'o canal não muda depois de criada');
select throws_ok($$delete from public.campaigns$$, '42501', null, 'campanhas não são apagadas');

-- ------------------------------------------------------------ leads na campanha
select lives_ok($$insert into public.campaign_leads (organization_id, campaign_id, lead_id)
  select org_a, (select id from public.campaigns where name = 'Camp e-mail'), (select ana from ids) from ctx$$, 'inclui um lead (a campanha ainda é rascunho)');
select throws_ok($$insert into public.campaign_leads (organization_id, campaign_id, lead_id)
  select org_a, (select id from public.campaigns where name = 'Camp e-mail'), (select ana from ids) from ctx$$, '23505', null, 'o lead não entra duas vezes');
select throws_ok($$insert into public.campaign_leads (organization_id, campaign_id, lead_id)
  select org_a, (select id from public.campaigns where name = 'Camp e-mail'), (select eva from ids) from ctx$$, '23514', null, 'lead "não contatar" não entra');
select lives_ok($$insert into public.campaigns (organization_id, name, channel, temperature, step1_template_id)
  select org_a, 'Zap morno', 'whatsapp', 'warm', (select z1 from ids) from ctx$$, 'campanha de WhatsApp para mornos');
select throws_ok($$insert into public.campaign_leads (organization_id, campaign_id, lead_id)
  select org_a, (select id from public.campaigns where name = 'Zap morno'), (select ana from ids) from ctx$$, '23514', null, 'lead frio não entra em campanha de WhatsApp');
select lives_ok($$insert into public.campaign_leads (organization_id, campaign_id, lead_id)
  select org_a, (select id from public.campaigns where name = 'Zap morno'), (select caio from ids) from ctx$$, 'lead morno com telefone entra');

-- ----------------------------------------------------------- rascunhos e passos
select throws_ok($$insert into public.outbound_messages (organization_id, lead_id, template_id, channel, subject, body, campaign_id)
  select org_a, (select ana from ids), (select t1 from ids), 'email', 'x', 'y', (select id from public.campaigns where name = 'Camp e-mail') from ctx$$,
  '23514', null, 'campanha em rascunho não gera rascunhos');
select lives_ok($$update public.campaigns set status = 'active' where name = 'Camp e-mail'$$, 'ativa a campanha');
select throws_ok($$insert into public.outbound_messages (organization_id, lead_id, template_id, channel, subject, body, campaign_id)
  select org_a, (select ana from ids), (select t2 from ids), 'email', 'x', 'y', (select id from public.campaigns where name = 'Camp e-mail') from ctx$$,
  '23514', null, 'os passos seguem a ordem: não pula para o lembrete');
select lives_ok($$insert into public.outbound_messages (organization_id, lead_id, template_id, channel, subject, body, campaign_id)
  select org_a, (select ana from ids), (select t1 from ids), 'email', 'x', 'y', (select id from public.campaigns where name = 'Camp e-mail') from ctx$$,
  '1ª mensagem da campanha vira rascunho na fila');
select is((select next_step_on - current_date from public.campaign_leads where lead_id = (select ana from ids) and campaign_id = (select id from public.campaigns where name = 'Camp e-mail')),
  3, 'o 1º lembrete fica para D+3');
select lives_ok($$insert into public.outbound_messages (organization_id, lead_id, template_id, channel, subject, body, campaign_id)
  select org_a, (select ana from ids), (select t2 from ids), 'email', 'x', 'y', (select id from public.campaigns where name = 'Camp e-mail') from ctx$$,
  'lembrete 1 gera rascunho');
select is((select next_step_on - current_date from public.campaign_leads where lead_id = (select ana from ids) and campaign_id = (select id from public.campaigns where name = 'Camp e-mail')),
  7, 'o 2º lembrete fica para D+7 (contado a partir da 1ª mensagem)');
select lives_ok($$insert into public.outbound_messages (organization_id, lead_id, template_id, channel, subject, body, campaign_id)
  select org_a, (select ana from ids), (select t3 from ids), 'email', 'x', 'y', (select id from public.campaigns where name = 'Camp e-mail') from ctx$$,
  'lembrete 2 gera rascunho');
select is((select status from public.campaign_leads where lead_id = (select ana from ids) and campaign_id = (select id from public.campaigns where name = 'Camp e-mail')),
  'finished', 'depois do último passo a sequência termina');

-- --------------------------------------------------------- resposta, saída e pausa
select lives_ok($$insert into public.campaign_leads (organization_id, campaign_id, lead_id)
  select org_a, (select id from public.campaigns where name = 'Camp e-mail'), (select bia from ids) from ctx$$, 'inclui outro lead na campanha ativa');
select lives_ok($$update public.leads set stage = 'replied' where id = (select bia from ids)$$, 'o lead responde (etapa "Respondeu")');
select is((select status from public.campaign_leads where lead_id = (select bia from ids) and campaign_id = (select id from public.campaigns where name = 'Camp e-mail')),
  'replied', 'quem respondeu sai da sequência');
select throws_ok($$insert into public.outbound_messages (organization_id, lead_id, template_id, channel, subject, body, campaign_id)
  select org_a, (select bia from ids), (select t1 from ids), 'email', 'x', 'y', (select id from public.campaigns where name = 'Camp e-mail') from ctx$$,
  '23514', null, 'lead que respondeu não recebe novo rascunho');
select lives_ok($$insert into public.campaign_leads (organization_id, campaign_id, lead_id)
  select org_a, (select id from public.campaigns where name = 'Camp e-mail'), (select fabio from ids) from ctx$$, 'inclui mais um lead');
select lives_ok($$update public.leads set opted_out_at = now() where id = (select fabio from ids)$$, 'o lead pede para sair');
select is((select status from public.campaign_leads where lead_id = (select fabio from ids) and campaign_id = (select id from public.campaigns where name = 'Camp e-mail')),
  'opted_out', 'quem pediu para sair é marcado na campanha');
select lives_ok($$update public.campaigns set status = 'paused' where name = 'Camp e-mail'$$, 'pausa a campanha');
select throws_ok($$insert into public.outbound_messages (organization_id, lead_id, template_id, channel, subject, body, campaign_id)
  select org_a, (select gus from ids), (select t1 from ids), 'email', 'x', 'y', (select id from public.campaigns where name = 'Camp e-mail') from ctx$$,
  '23514', null, 'campanha pausada não gera rascunhos');

-- o usuário marca "respondeu" e retoma; "saiu" e "falhou" não são dele
select lives_ok($$insert into public.campaign_leads (organization_id, campaign_id, lead_id)
  select org_a, (select id from public.campaigns where name = 'Camp e-mail'), (select gus from ids) from ctx$$, 'inclui lead em campanha pausada (só não gera rascunho)');
select lives_ok($$update public.campaign_leads set status = 'replied' where lead_id = (select gus from ids)$$, 'usuário marca "respondeu"');
select lives_ok($$update public.campaign_leads set status = 'active' where lead_id = (select gus from ids)$$, 'usuário retoma a sequência');
select throws_ok($$update public.campaign_leads set status = 'opted_out' where lead_id = (select gus from ids)$$, '23514', null, 'usuário não marca "saiu" (vem do sistema)');

-- encerrar
select lives_ok($$update public.campaigns set status = 'finished' where name = 'Camp e-mail'$$, 'encerra a campanha');
select throws_ok($$update public.campaigns set status = 'active' where name = 'Camp e-mail'$$, '23514', null, 'campanha encerrada não volta');
select throws_ok($$insert into public.campaign_leads (organization_id, campaign_id, lead_id)
  select org_a, (select id from public.campaigns where name = 'Camp e-mail'), (select hugo from ids) from ctx$$, '23514', null, 'campanha encerrada não recebe leads');
reset role;

select public.t_act_as('bbbbbbbb-0000-0000-0000-000000000002');
select is((select count(*)::int from public.campaigns) + (select count(*)::int from public.campaign_leads), 0, 'B não enxerga campanhas nem leads de A');
select throws_ok($$insert into public.campaigns (organization_id, name, channel) select org_a, 'Invasora', 'email' from ctx$$, '42501', null, 'B não cria campanha em A');
reset role;

select * from finish();
rollback;

-- Fase 7.1: leads, lista de supressão e configuração de envio.
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

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
       (select id from public.organizations where created_by = 'bbbbbbbb-0000-0000-0000-000000000002') as org_b;
grant select on ctx to authenticated;
insert into public.organization_members (organization_id, user_id, role)
  select org_a, 'cccccccc-0000-0000-0000-000000000003', 'member' from ctx;

-- ===================================================== A (owner): leads
select public.t_act_as('aaaaaaaa-0000-0000-0000-000000000001');
select lives_ok($$insert into public.leads (organization_id, company_name, email, phone, source, website)
  select org_a, 'Padaria Sol', '  Contato@PadariaSol.com.br ', '+5511912345678', 'Planilha out/2026', 'https://padariasol.com.br'
  from ctx$$, 'owner cria lead');
select is((select email from public.leads where company_name = 'Padaria Sol'), 'contato@padariasol.com.br',
  'e-mail é guardado em minúsculas e sem espaços');
select is((select temperature || '/' || stage from public.leads where company_name = 'Padaria Sol'), 'cold/new',
  'lead nasce frio e novo');

select throws_ok($$insert into public.leads (organization_id, company_name, email, source)
  select org_a, 'Duplicada', 'CONTATO@padariasol.com.br', 'x' from ctx$$, '23505', null,
  'e-mail duplicado (sem diferença de caixa) é recusado');
select throws_ok($$insert into public.leads (organization_id, company_name, phone, source)
  select org_a, 'Duplicada', '+5511912345678', 'x' from ctx$$, '23505', null, 'telefone duplicado é recusado');
select throws_ok($$insert into public.leads (organization_id, company_name, phone, source)
  select org_a, 'Telefone ruim', '(11) 91234-5678', 'x' from ctx$$, '23514', null, 'telefone fora do E.164 é recusado');
select throws_ok($$insert into public.leads (organization_id, company_name, website, source)
  select org_a, 'Site ruim', 'javascript:alert(1)', 'x' from ctx$$, '23514', null, 'site que não é http(s) é recusado');
select throws_ok($$insert into public.leads (organization_id, company_name, source)
  select org_a, 'Sem origem', '   ' from ctx$$, '23514', null, 'origem é obrigatória');
select throws_ok($$update public.leads set temperature = 'fervendo' where company_name = 'Padaria Sol'$$,
  '23514', null, 'temperatura fora da lista é recusada');
select throws_ok($$update public.leads set stage = 'qualquer' where company_name = 'Padaria Sol'$$,
  '23514', null, 'etapa fora da lista é recusada');
select lives_ok($$update public.leads set temperature = 'warm', stage = 'replied', hook = 'Cardápio só em PDF no site'
  where company_name = 'Padaria Sol'$$, 'owner muda temperatura, etapa e gancho');
select throws_ok($$update public.leads set has_whatsapp = true where company_name = 'Padaria Sol'$$,
  '42501', null, 'has_whatsapp é preenchido só pelo servidor');

-- "Não contatar" suprime e-mail e telefone em todos os canais.
select lives_ok($$update public.leads set opted_out_at = now() where company_name = 'Padaria Sol'$$,
  'owner marca o lead como não contatar');
select is((select string_agg(channel || ':' || value, ',' order by value) from public.suppression_list),
  'all:+5511912345678,all:contato@padariasol.com.br', 'e-mail e telefone entram na supressão de todos os canais');

-- ===================================================== supressão
select lives_ok($$insert into public.suppression_list (organization_id, channel, value, reason)
  select org_a, 'email', 'naoquero@exemplo.com', 'manual' from ctx$$, 'owner adiciona supressão manual');
select throws_ok($$insert into public.suppression_list (organization_id, channel, value, reason)
  select org_a, 'email', 'outro@exemplo.com', 'opt_out' from ctx$$, '42501', null,
  'pedido de saída do lead só vem do servidor');
select throws_ok($$insert into public.suppression_list (organization_id, channel, value, reason)
  select org_a, 'email', 'MAIUSCULO@exemplo.com', 'manual' from ctx$$, '23514', null, 'valor precisa estar normalizado');
reset role;
insert into public.suppression_list (organization_id, channel, value, reason)
  select org_a, 'whatsapp', '+5511999990000', 'opt_out' from ctx;
select public.t_act_as('aaaaaaaa-0000-0000-0000-000000000001');
select is(public.t_rowcount($$delete from public.suppression_list where reason = 'opt_out'$$), 0,
  'saída pedida pelo lead não é apagada pela tela');
select is(public.t_rowcount($$delete from public.suppression_list where value = 'naoquero@exemplo.com'$$), 1,
  'supressão manual pode ser desfeita');

-- ===================================================== configuração
select lives_ok($$insert into public.outreach_settings (organization_id) select org_a from ctx$$,
  'owner cria a configuração de envio com os padrões');
select throws_ok($$update public.outreach_settings set email_daily_limit = 101$$, '23514', null,
  'limite diário de e-mail acima do plano grátis é recusado');
reset role;

-- ===================================================== B e C
select public.t_act_as('bbbbbbbb-0000-0000-0000-000000000002');
select is((select count(*)::int from public.leads) + (select count(*)::int from public.suppression_list), 0,
  'B não enxerga leads nem supressões de A');
reset role;

select public.t_act_as('cccccccc-0000-0000-0000-000000000003');
select is((select count(*)::int from public.leads), 1, 'membro enxerga os leads da organização');
select throws_ok($$insert into public.leads (organization_id, company_name, source) select org_a, 'Membro', 'x' from ctx$$,
  '42501', null, 'membro não cria lead');
reset role;

select * from finish();
rollback;

-- D093: valor do projeto e parcelas. Isolamento, escrita só do owner, restrições, moeda travada,
-- parcela recebida não se exclui e valores fora da trilha de atividade.
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

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
       null::uuid as project_a, null::uuid as project_b;
grant select on ctx to authenticated;
insert into public.organization_members (organization_id, user_id, role)
  select org_a, 'cccccccc-0000-0000-0000-000000000003', 'member' from ctx;
insert into public.projects (organization_id, name) select org_a, 'Projeto A' from ctx;
insert into public.projects (organization_id, name) select org_b, 'Projeto B' from ctx;
update ctx set
  project_a = (select id from public.projects where organization_id = ctx.org_a and name = 'Projeto A'),
  project_b = (select id from public.projects where organization_id = ctx.org_b and name = 'Projeto B');

-- A (owner)
select public.t_act_as('aaaaaaaa-0000-0000-0000-000000000001');
select lives_ok($$update public.projects set contract_value_cents = 500000, currency = 'USD', billing_model = 'fixed'
  where id = (select project_a from ctx)$$, 'owner define valor, moeda e modelo do projeto');
select throws_ok($$update public.projects set currency = 'GBP' where id = (select project_a from ctx)$$,
  '23514', null, 'moeda fora da lista é rejeitada');
select throws_ok($$update public.projects set contract_value_cents = -1 where id = (select project_a from ctx)$$,
  '23514', null, 'valor negativo é rejeitado');
select lives_ok($$insert into public.project_payments (organization_id, project_id, kind, amount_cents, due_date, description)
  select org_a, project_a, 'advance', 150000, '2026-11-01', 'Sinal' from ctx$$, 'owner cria adiantamento');
select lives_ok($$insert into public.project_payments (organization_id, project_id, kind, amount_cents, due_date)
  select org_a, project_a, 'final', 350000, '2026-12-15' from ctx$$, 'owner cria saldo final');

select throws_ok($$insert into public.project_payments (organization_id, project_id, amount_cents, due_date)
  select org_a, project_a, 0, '2026-11-01' from ctx$$, '23514', null, 'valor da parcela precisa ser positivo');
select throws_ok($$update public.project_payments set status = 'paid' where kind = 'advance'$$,
  '23514', null, 'recebida exige a data em que caiu');
select lives_ok($$update public.project_payments set status = 'paid', paid_on = '2026-11-02' where kind = 'advance'$$,
  'owner marca como recebida com a data');
select throws_ok($$update public.projects set currency = 'EUR' where id = (select project_a from ctx)$$,
  '23514', null, 'moeda não muda depois de haver parcelas');
select is(public.t_rowcount($$delete from public.project_payments where kind = 'advance'$$), 0,
  'parcela recebida não é excluída');
select is(public.t_rowcount($$delete from public.project_payments where kind = 'final'$$), 1,
  'parcela a receber pode ser excluída');
select throws_ok($$insert into public.project_payments (organization_id, project_id, amount_cents, due_date)
  select org_a, project_b, 100, '2026-11-01' from ctx$$, '23503', null, 'FK composta: sem referenciar projeto de B');
reset role;

-- Valores e moeda não aparecem na trilha de atividade.
select is(
  (select count(*)::int from public.activity_logs
    where entity_type = 'project' and (changes ? 'contract_value_cents' or changes ? 'currency' or changes ? 'billing_model')),
  0, 'valor, moeda e modelo do projeto ficam fora de activity_logs');

-- B não enxerga nem altera.
select public.t_act_as('bbbbbbbb-0000-0000-0000-000000000002');
select is((select count(*)::int from public.project_payments), 0, 'B não enxerga parcelas de A');
select is(public.t_rowcount($$update public.project_payments set amount_cents = 1$$), 0, 'B não altera parcelas de A');
reset role;

-- C (membro): lê, não escreve.
select public.t_act_as('cccccccc-0000-0000-0000-000000000003');
select is((select count(*)::int from public.project_payments), 1, 'membro enxerga as parcelas da organização');
select throws_ok($$insert into public.project_payments (organization_id, project_id, amount_cents, due_date)
  select org_a, project_a, 100, '2026-11-01' from ctx$$, '42501', null, 'membro não cria parcela');
reset role;

select * from finish();
rollback;

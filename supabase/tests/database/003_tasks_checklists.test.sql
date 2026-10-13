-- Fase 3: tarefas, subtarefas, planejamento diário e checklists.
begin;
create extension if not exists pgtap with schema extensions;
select plan(42);

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

-- Dados do tenant B e membro C (não owner) em A.
insert into public.clients (id, organization_id, name) select 'bbbbbbbb-1111-0000-0000-000000000001', org_b, 'Cliente B' from ctx;
insert into public.projects (id, organization_id, name) select 'bbbbbbbb-2222-0000-0000-000000000001', org_b, 'Projeto B' from ctx;
insert into public.tasks (id, organization_id, title) select 'bbbbbbbb-3333-0000-0000-000000000001', org_b, 'Tarefa B' from ctx;
insert into public.organization_members (organization_id, user_id, role)
  select org_a, 'cccccccc-0000-0000-0000-000000000003', 'member' from ctx;

-- ============================================================ A (owner)
select public.t_act_as('aaaaaaaa-0000-0000-0000-000000000001');

select lives_ok($$insert into public.tasks (organization_id, title) select org_a, 'Captura rápida' from ctx$$,
  'captura rápida só com título');
select is((select status || '/' || priority from public.tasks where title = 'Captura rápida'), 'todo/medium',
  'defaults de status e prioridade');
select is((select count(*)::int from public.tasks), 1, 'A vê só as próprias tarefas');

-- prazo
select throws_ok($$insert into public.tasks (organization_id, title, due_date, due_at)
  select org_a, 'x', '2026-11-01', now() from ctx$$, '23514', null, 'due_date e due_at são exclusivos');
select lives_ok($$insert into public.tasks (organization_id, title, due_at)
  select org_a, 'com hora', '2026-11-01T10:00:00Z' from ctx$$, 'prazo com hora');
select lives_ok($$insert into public.tasks (organization_id, title, due_date, estimated_minutes)
  select org_a, 'com data', '2026-11-02', 30 from ctx$$, 'prazo de dia inteiro');
select throws_ok($$insert into public.tasks (organization_id, title, estimated_minutes)
  select org_a, 'x', 0 from ctx$$, '23514', null, 'estimativa deve ser positiva');
select throws_ok($$insert into public.tasks (organization_id, title, status)
  select org_a, 'x', 'wip' from ctx$$, '23514', null, 'status inválido');

-- vínculos entre tenants
select throws_ok($$insert into public.tasks (organization_id, title, project_id)
  select org_a, 'x', 'bbbbbbbb-2222-0000-0000-000000000001' from ctx$$, '23503', null, 'projeto de outra organização');
select throws_ok($$insert into public.tasks (organization_id, title, client_id)
  select org_a, 'x', 'bbbbbbbb-1111-0000-0000-000000000001' from ctx$$, '23503', null, 'cliente de outra organização');
select throws_ok($$insert into public.tasks (organization_id, title, parent_task_id)
  select org_a, 'x', 'bbbbbbbb-3333-0000-0000-000000000001' from ctx$$, '23503', null, 'tarefa-pai de outra organização');
select throws_ok($$insert into public.tasks (organization_id, title, assigned_to)
  select org_a, 'x', 'bbbbbbbb-0000-0000-0000-000000000002' from ctx$$, '23503', null, 'responsável fora da organização');
select lives_ok($$insert into public.tasks (organization_id, title, assigned_to)
  select org_a, 'atribuída', 'cccccccc-0000-0000-0000-000000000003' from ctx$$, 'responsável membro da organização');
select throws_ok($$insert into public.tasks (organization_id, title)
  select org_b, 'invasora' from ctx$$, '42501', null, 'A não cria tarefa na organização B');

-- subtarefas e ciclos
select lives_ok($$insert into public.tasks (organization_id, title, parent_task_id)
  select org_a, 'Subtarefa', t.id from ctx, public.tasks t where t.title = 'Captura rápida'$$, 'cria subtarefa');
select throws_ok($$update public.tasks set parent_task_id = id where title = 'Captura rápida'$$,
  '23514', null, 'tarefa não é pai de si mesma');
select throws_ok($$update public.tasks set parent_task_id = (select id from public.tasks where title = 'Subtarefa')
  where title = 'Captura rápida'$$, '23514', null, 'ciclo pai→filho→pai é rejeitado');

-- conclusão
select lives_ok($$update public.tasks set status = 'done' where title = 'Captura rápida'$$, 'conclui tarefa');
select ok((select completed_at is not null from public.tasks where title = 'Captura rápida'), 'completed_at definido pelo banco');
select lives_ok($$update public.tasks set status = 'todo' where title = 'Captura rápida'$$, 'reabre tarefa');
select ok((select completed_at is null from public.tasks where title = 'Captura rápida'), 'completed_at limpo ao reabrir');
select throws_ok($$update public.tasks set completed_at = now() where title = 'Captura rápida'$$,
  '42501', null, 'cliente não escreve completed_at');
select throws_ok($$delete from public.tasks$$, '42501', null, 'cliente não apaga tarefas');

-- planejamento diário: não altera prazo
select lives_ok($$insert into public.task_plans (organization_id, task_id, planned_date)
  select org_a, t.id, '2026-11-05' from ctx, public.tasks t where t.title = 'com data'$$, 'planeja tarefa para um dia');
select throws_ok($$insert into public.task_plans (organization_id, task_id, planned_date)
  select org_a, t.id, '2026-11-05' from ctx, public.tasks t where t.title = 'com data'$$,
  '23505', null, 'mesmo dia ativo não duplica');
select lives_ok($$update public.task_plans set planned_date = '2026-11-06'$$, 'move o planejamento');
select is((select due_date from public.tasks where title = 'com data'), '2026-11-02'::date,
  'mover planejamento não altera o prazo');
select throws_ok($$insert into public.task_plans (organization_id, task_id, planned_date)
  select org_a, 'bbbbbbbb-3333-0000-0000-000000000001', '2026-11-05' from ctx$$,
  '23503', null, 'plano não referencia tarefa de outra organização');

-- checklists: cópia não é retroativa
select lives_ok($$insert into public.checklist_templates (organization_id, name, category)
  select org_a, 'Onboarding', 'processo' from ctx$$, 'cria modelo');
select lives_ok($$insert into public.checklist_template_items (organization_id, template_id, title, sort_order)
  select org_a, t.id, 'Passo 1', 0 from ctx, public.checklist_templates t where t.name = 'Onboarding'$$, 'item do modelo');
select lives_ok($$insert into public.checklist_items (organization_id, task_id, title, sort_order)
  select org_a, t.id, i.title, i.sort_order
    from ctx, public.tasks t, public.checklist_template_items i where t.title = 'com data'$$,
  'copia itens do modelo para a tarefa');
select lives_ok($$update public.checklist_template_items set title = 'Passo 1 (alterado)'$$, 'altera o modelo depois');
select is((select title from public.checklist_items), 'Passo 1', 'checklist copiado não muda retroativamente');
select lives_ok($$update public.checklist_items set is_completed = true$$, 'marca item');
select ok((select completed_at is not null from public.checklist_items), 'completed_at do item definido');
select is(public.t_rowcount($$delete from public.checklist_items$$), 1, 'owner remove item de checklist');
reset role;

-- ============================================================ C (member)
select public.t_act_as('cccccccc-0000-0000-0000-000000000003');
select ok((select count(*) from public.tasks) >= 4, 'member lê tarefas');
select throws_ok($$insert into public.tasks (organization_id, title) select org_a, 'por member' from ctx$$,
  '42501', null, 'member não cria tarefa');
reset role;

-- ============================================================ B isolado
select public.t_act_as('bbbbbbbb-0000-0000-0000-000000000002');
select is((select count(*)::int from public.tasks where organization_id = (select org_a from ctx)), 0,
  'B não lê tarefas de A');
reset role;

-- priority_rank: coluna gerada (ordenação por importância), nunca escrita pelo cliente
insert into public.tasks (organization_id, title, priority)
  select org_a, t.title, t.priority
    from ctx, (values ('rank-baixa', 'low'), ('rank-media', 'medium'), ('rank-alta', 'high'), ('rank-urgente', 'urgent')) as t(title, priority);
select is(
  (select array_agg(title order by priority_rank desc, title) from public.tasks where title like 'rank-%'),
  array['rank-urgente', 'rank-alta', 'rank-media', 'rank-baixa'],
  'priority_rank ordena por importância (urgente > alta > média > baixa)');
select ok(not has_column_privilege('authenticated', 'public.tasks', 'priority_rank', 'UPDATE'),
  'cliente não atualiza priority_rank');
select ok(not has_column_privilege('authenticated', 'public.tasks', 'priority_rank', 'INSERT'),
  'cliente não insere priority_rank');

select * from finish();
rollback;

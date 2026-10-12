-- Fase 3: tasks, task_plans, checklist_templates, checklist_template_items, checklist_items.
-- meeting_id e recurrence_rule_id chegam na Fase 4, com as tabelas que referenciam.
-- Prazo (due_date | due_at), dia planejado (task_plans) e bloco de tempo (Fase 4) são independentes (D003).

-- ------------------------------------------------------------------ tasks
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid,
  client_id uuid,
  parent_task_id uuid,
  title text not null check (char_length(btrim(title)) between 1 and 300),
  description text check (description is null or char_length(description) <= 20000),
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done', 'cancelled')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  due_date date,
  due_at timestamptz,
  estimated_minutes integer check (estimated_minutes is null or estimated_minutes > 0),
  assigned_to uuid,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  -- Prazo de dia inteiro OU com hora; nunca os dois (D032).
  check (num_nonnulls(due_date, due_at) <= 1),
  check ((status = 'done') = (completed_at is not null)),
  foreign key (organization_id, project_id) references public.projects (organization_id, id),
  foreign key (organization_id, client_id) references public.clients (organization_id, id),
  foreign key (organization_id, parent_task_id) references public.tasks (organization_id, id),
  foreign key (organization_id, assigned_to)
    references public.organization_members (organization_id, user_id)
);

create index tasks_org_open_due_idx on public.tasks (organization_id, due_date, due_at)
  where status in ('todo', 'in_progress');
create index tasks_org_status_idx on public.tasks (organization_id, status);
create index tasks_org_project_idx on public.tasks (organization_id, project_id) where project_id is not null;
create index tasks_org_client_idx on public.tasks (organization_id, client_id) where client_id is not null;
create index tasks_org_parent_idx on public.tasks (organization_id, parent_task_id) where parent_task_id is not null;
create index tasks_org_assignee_idx on public.tasks (organization_id, assigned_to) where assigned_to is not null;

-- completed_at é derivado do status; o cliente não escreve nele.
create function private.tasks_completion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'done' then
    if tg_op = 'INSERT' or old.status <> 'done' then
      new.completed_at := now();
    else
      new.completed_at := old.completed_at;
    end if;
  else
    new.completed_at := null;
  end if;
  return new;
end;
$$;

create trigger tasks_completion before insert or update on public.tasks
  for each row execute function private.tasks_completion();

-- Evita ciclos na árvore de subtarefas (auto-referência inclusive).
create function private.prevent_task_cycles()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cursor uuid;
  v_steps int := 0;
begin
  if new.parent_task_id is null then
    return new;
  end if;
  if new.parent_task_id = new.id then
    raise exception 'a task cannot be its own parent' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and new.parent_task_id is not distinct from old.parent_task_id then
    return new;
  end if;

  -- Serializa mudanças de hierarquia da organização para impedir ciclos concorrentes.
  perform pg_advisory_xact_lock(hashtextextended('task_tree:' || new.organization_id::text, 0));

  v_cursor := new.parent_task_id;
  while v_cursor is not null loop
    if v_cursor = new.id then
      raise exception 'task hierarchy cycle detected' using errcode = '23514';
    end if;
    v_steps := v_steps + 1;
    if v_steps > 100 then
      raise exception 'task hierarchy too deep' using errcode = '23514';
    end if;
    select t.parent_task_id into v_cursor from public.tasks t where t.id = v_cursor;
  end loop;
  return new;
end;
$$;

create trigger tasks_prevent_cycles before insert or update of parent_task_id on public.tasks
  for each row execute function private.prevent_task_cycles();

create trigger tasks_set_updated_at before update on public.tasks
  for each row execute function private.set_updated_at();

-- ------------------------------------------------------------- task_plans
create table public.task_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  task_id uuid not null,
  planned_date date not null,
  sort_order integer not null default 0,
  status text not null default 'planned' check (status in ('planned', 'done', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, task_id) references public.tasks (organization_id, id)
);

-- Uma tarefa não é planejada duas vezes para o mesmo dia enquanto o plano estiver ativo.
create unique index task_plans_active_unique on public.task_plans (task_id, planned_date)
  where status = 'planned';
create index task_plans_org_day_idx on public.task_plans (organization_id, planned_date, sort_order);
create index task_plans_task_idx on public.task_plans (organization_id, task_id);

create trigger task_plans_set_updated_at before update on public.task_plans
  for each row execute function private.set_updated_at();

-- ------------------------------------------------------ checklist templates
create table public.checklist_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  description text check (description is null or char_length(description) <= 2000),
  category text check (category is null or char_length(category) <= 80),
  created_at timestamptz not null default now(),
  unique (organization_id, id)
);

create table public.checklist_template_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  template_id uuid not null,
  title text not null check (char_length(btrim(title)) between 1 and 300),
  sort_order integer not null default 0,
  foreign key (organization_id, template_id)
    references public.checklist_templates (organization_id, id) on delete cascade
);

create index checklist_template_items_idx
  on public.checklist_template_items (organization_id, template_id, sort_order);

-- Itens da tarefa: cópia independente do modelo (não mudam retroativamente).
create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  task_id uuid not null,
  title text not null check (char_length(btrim(title)) between 1 and 300),
  is_completed boolean not null default false,
  sort_order integer not null default 0,
  completed_at timestamptz,
  foreign key (organization_id, task_id) references public.tasks (organization_id, id)
);

create index checklist_items_task_idx on public.checklist_items (organization_id, task_id, sort_order);

create function private.checklist_items_completion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_completed then
    if tg_op = 'INSERT' or not old.is_completed then
      new.completed_at := now();
    else
      new.completed_at := old.completed_at;
    end if;
  else
    new.completed_at := null;
  end if;
  return new;
end;
$$;

create trigger checklist_items_completion before insert or update on public.checklist_items
  for each row execute function private.checklist_items_completion();

-- ----------------------------------------------------------------- grants
revoke all on public.tasks, public.task_plans, public.checklist_templates,
  public.checklist_template_items, public.checklist_items from public, anon, authenticated;

grant select on public.tasks, public.task_plans, public.checklist_templates,
  public.checklist_template_items, public.checklist_items to authenticated;

grant insert (organization_id, project_id, client_id, parent_task_id, title, description, status,
              priority, due_date, due_at, estimated_minutes, assigned_to)
  on public.tasks to authenticated;
grant update (project_id, client_id, parent_task_id, title, description, status,
              priority, due_date, due_at, estimated_minutes, assigned_to)
  on public.tasks to authenticated;

grant insert (organization_id, task_id, planned_date, sort_order, status) on public.task_plans to authenticated;
grant update (planned_date, sort_order, status) on public.task_plans to authenticated;
grant delete on public.task_plans to authenticated;

grant insert (organization_id, name, description, category) on public.checklist_templates to authenticated;
grant update (name, description, category) on public.checklist_templates to authenticated;
grant delete on public.checklist_templates to authenticated;

grant insert (organization_id, template_id, title, sort_order) on public.checklist_template_items to authenticated;
grant update (title, sort_order) on public.checklist_template_items to authenticated;
grant delete on public.checklist_template_items to authenticated;

grant insert (organization_id, task_id, title, is_completed, sort_order) on public.checklist_items to authenticated;
grant update (title, is_completed, sort_order) on public.checklist_items to authenticated;
grant delete on public.checklist_items to authenticated;

-- -------------------------------------------------------------------- RLS
alter table public.tasks enable row level security;
alter table public.task_plans enable row level security;
alter table public.checklist_templates enable row level security;
alter table public.checklist_template_items enable row level security;
alter table public.checklist_items enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['tasks', 'task_plans', 'checklist_templates', 'checklist_template_items', 'checklist_items']
  loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (private.is_active_member(organization_id))',
      t || '_select_member', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (private.is_active_owner(organization_id))',
      t || '_insert_owner', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (private.is_active_owner(organization_id)) with check (private.is_active_owner(organization_id))',
      t || '_update_owner', t);
  end loop;

  -- DELETE só onde não há histórico de negócio (tasks permanece sem DELETE: cancela-se).
  foreach t in array array['task_plans', 'checklist_templates', 'checklist_template_items', 'checklist_items']
  loop
    execute format(
      'create policy %I on public.%I for delete to authenticated using (private.is_active_owner(organization_id))',
      t || '_delete_owner', t);
  end loop;
end $$;

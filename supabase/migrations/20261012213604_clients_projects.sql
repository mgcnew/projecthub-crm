-- Fase 2: clients, projects, project_logs. RLS e grants junto das tabelas.
-- Arquivamento por archived_at; sem DELETE para o cliente (D026). Escrita só de owner ativo (D018).

-- --------------------------------------------------------------- clients
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  company_name text check (company_name is null or char_length(company_name) <= 200),
  email text check (email is null or (char_length(email) <= 254 and email like '%_@_%')),
  phone text check (phone is null or char_length(phone) <= 40),
  status text not null default 'active' check (status in ('active', 'inactive')),
  notes text check (notes is null or char_length(notes) <= 10000),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

create index clients_org_active_idx on public.clients (organization_id, name) where archived_at is null;
create index clients_org_status_idx on public.clients (organization_id, status);

-- --------------------------------------------------------------- projects
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  client_id uuid,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  description text check (description is null or char_length(description) <= 10000),
  status text not null default 'planning'
    check (status in ('planning', 'active', 'on_hold', 'completed', 'cancelled')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  started_on date,
  target_date date,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  check (started_on is null or target_date is null or target_date >= started_on),
  -- FK composta: o cliente tem de pertencer à mesma organização. client_id nulo = projeto sem cliente.
  foreign key (organization_id, client_id) references public.clients (organization_id, id)
);

create index projects_org_status_idx on public.projects (organization_id, status) where archived_at is null;
create index projects_org_target_idx on public.projects (organization_id, target_date) where archived_at is null;
create index projects_org_client_idx on public.projects (organization_id, client_id);

-- ----------------------------------------------------------- project_logs
create table public.project_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid not null,
  author_id uuid not null references auth.users (id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  content text not null default '' check (char_length(content) <= 20000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, project_id) references public.projects (organization_id, id)
);

create index project_logs_project_idx on public.project_logs (organization_id, project_id, created_at desc);

create trigger clients_set_updated_at before update on public.clients
  for each row execute function private.set_updated_at();
create trigger projects_set_updated_at before update on public.projects
  for each row execute function private.set_updated_at();
create trigger project_logs_set_updated_at before update on public.project_logs
  for each row execute function private.set_updated_at();

-- ----------------------------------------------------------------- grants
revoke all on public.clients, public.projects, public.project_logs from public, anon, authenticated;

grant select on public.clients, public.projects, public.project_logs to authenticated;

grant insert (organization_id, name, company_name, email, phone, status, notes)
  on public.clients to authenticated;
grant update (name, company_name, email, phone, status, notes, archived_at)
  on public.clients to authenticated;

grant insert (organization_id, client_id, name, description, status, priority, started_on, target_date)
  on public.projects to authenticated;
grant update (client_id, name, description, status, priority, started_on, target_date, archived_at)
  on public.projects to authenticated;

grant insert (organization_id, project_id, author_id, title, content)
  on public.project_logs to authenticated;
grant update (title, content) on public.project_logs to authenticated;

-- -------------------------------------------------------------------- RLS
alter table public.clients enable row level security;
alter table public.projects enable row level security;
alter table public.project_logs enable row level security;

create policy clients_select_member on public.clients
  for select to authenticated using (private.is_active_member(organization_id));
create policy clients_insert_owner on public.clients
  for insert to authenticated with check (private.is_active_owner(organization_id));
create policy clients_update_owner on public.clients
  for update to authenticated
  using (private.is_active_owner(organization_id))
  with check (private.is_active_owner(organization_id));

create policy projects_select_member on public.projects
  for select to authenticated using (private.is_active_member(organization_id));
create policy projects_insert_owner on public.projects
  for insert to authenticated with check (private.is_active_owner(organization_id));
create policy projects_update_owner on public.projects
  for update to authenticated
  using (private.is_active_owner(organization_id))
  with check (private.is_active_owner(organization_id));

create policy project_logs_select_member on public.project_logs
  for select to authenticated using (private.is_active_member(organization_id));
-- author_id vem sempre da sessão, nunca do cliente.
create policy project_logs_insert_owner on public.project_logs
  for insert to authenticated
  with check (private.is_active_owner(organization_id) and author_id = (select auth.uid()));
create policy project_logs_update_author on public.project_logs
  for update to authenticated
  using (private.is_active_owner(organization_id) and author_id = (select auth.uid()))
  with check (private.is_active_owner(organization_id) and author_id = (select auth.uid()));

-- Fase 1 / identidade: profiles, organizations, organization_members.
-- RLS e grants vêm junto das tabelas (DATABASE_SPEC: nunca publicar tabela sem política).

-- Schema não exposto pela API (config.toml [api].schemas não o inclui).
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------- tabelas
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 120),
  avatar_path text check (avatar_path is null or char_length(avatar_path) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  -- restrict: um usuário dono de organização não é apagado sem tratar a organização antes.
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  status text not null default 'active' check (status in ('active', 'suspended')),
  joined_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create index organization_members_user_active_idx
  on public.organization_members (user_id)
  where status = 'active';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function private.set_updated_at();

-- ------------------------------------------------- proteção do último owner
create function private.protect_last_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_exists boolean;
begin
  if old.role = 'owner' and old.status = 'active'
     and (tg_op = 'DELETE' or new.role <> 'owner' or new.status <> 'active') then
    -- Trava a organização para serializar remoções concorrentes de owners.
    -- Em exclusão em cascata da própria organização a linha já não existe: permitido.
    select true into v_org_exists
      from public.organizations o
     where o.id = old.organization_id
       for update;

    if v_org_exists
       and not exists (
         select 1
           from public.organization_members m
          where m.organization_id = old.organization_id
            and m.user_id <> old.user_id
            and m.role = 'owner'
            and m.status = 'active'
       ) then
      raise exception 'cannot remove, demote or suspend the last active owner of organization %', old.organization_id
        using errcode = '23514';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger organization_members_protect_last_owner
  before update or delete on public.organization_members
  for each row execute function private.protect_last_owner();

-- --------------------------------------------------------- helpers de RLS
create function private.is_active_member(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.organization_members m
     where m.organization_id = p_org
       and m.user_id = (select auth.uid())
       and m.status = 'active'
  );
$$;

create function private.is_active_owner(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.organization_members m
     where m.organization_id = p_org
       and m.user_id = (select auth.uid())
       and m.role = 'owner'
       and m.status = 'active'
  );
$$;

revoke all on function private.set_updated_at() from public, anon;
revoke all on function private.protect_last_owner() from public, anon, authenticated;
revoke all on function private.is_active_member(uuid) from public, anon;
revoke all on function private.is_active_owner(uuid) from public, anon;
grant execute on function private.is_active_member(uuid) to authenticated;
grant execute on function private.is_active_owner(uuid) to authenticated;

-- ---------------------------------------------------------------- grants
revoke all on public.profiles, public.organizations, public.organization_members
  from public, anon, authenticated;

grant select on public.profiles, public.organizations, public.organization_members to authenticated;
-- Escrita do cliente restrita por coluna; INSERT/DELETE nunca (provisionamento é privilegiado).
grant update (display_name, avatar_path) on public.profiles to authenticated;
grant update (name) on public.organizations to authenticated;

-- -------------------------------------------------------------------- RLS
alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy organizations_select_member on public.organizations
  for select to authenticated
  using (private.is_active_member(id));

create policy organizations_update_owner on public.organizations
  for update to authenticated
  using (private.is_active_owner(id))
  with check (private.is_active_owner(id));

-- Sem políticas de INSERT/UPDATE/DELETE em organization_members: nenhuma elevação por DML do cliente.
create policy organization_members_select_member on public.organization_members
  for select to authenticated
  using (private.is_active_member(organization_id));

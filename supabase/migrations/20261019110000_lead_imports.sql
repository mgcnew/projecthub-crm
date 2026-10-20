-- Fase 7.2: histórico de importações de leads (planilha CSV). Guarda só contagens e os motivos das linhas
-- recusadas (até 200), nunca o arquivo. Histórico: sem UPDATE nem DELETE pelo cliente.
create table public.lead_imports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  file_name text not null check (char_length(btrim(file_name)) between 1 and 255),
  source text not null check (char_length(btrim(source)) between 1 and 200),
  total integer not null check (total between 0 and 5000),
  created integer not null default 0 check (created >= 0),
  updated integer not null default 0 check (updated >= 0),
  skipped integer not null default 0 check (skipped >= 0),
  -- [{ "line": 12, "reason": "Telefone inválido" }, ...]
  errors jsonb not null default '[]'::jsonb
    check (jsonb_typeof(errors) = 'array' and jsonb_array_length(errors) <= 200),
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  check (created + updated + skipped <= total)
);

create index lead_imports_org_created_idx on public.lead_imports (organization_id, created_at desc);

revoke all on public.lead_imports from public, anon, authenticated;
grant select on public.lead_imports to authenticated;
grant insert (organization_id, file_name, source, total, created, updated, skipped, errors)
  on public.lead_imports to authenticated;

alter table public.lead_imports enable row level security;

create policy lead_imports_select_member on public.lead_imports
  for select to authenticated using (private.is_active_member(organization_id));
create policy lead_imports_insert_owner on public.lead_imports
  for insert to authenticated with check (private.is_active_owner(organization_id));
create policy mfa_required on public.lead_imports as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

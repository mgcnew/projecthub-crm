-- Etapa 3 (D098): relacionamento com o cliente — próximo contato (data + lembrete curto), registro de
-- interações (ligação, e-mail, reunião, mensagem, nota) e links de documentos (contrato, proposta, briefing).
-- Sem upload de arquivos: documento é um link (Drive etc.). Sem trilha em activity_logs.

alter table public.clients
  add column next_contact_on date,
  add column next_contact_note text check (next_contact_note is null or char_length(next_contact_note) <= 200);

grant insert (next_contact_on, next_contact_note) on public.clients to authenticated;
grant update (next_contact_on, next_contact_note) on public.clients to authenticated;

-- Alvo de FK composta que garante que o contato pertence ao MESMO cliente da interação.
alter table public.client_contacts add constraint client_contacts_org_client_id_key unique (organization_id, client_id, id);

create table public.client_interactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  client_id uuid not null,
  contact_id uuid,
  kind text not null default 'note' check (kind in ('call', 'email', 'meeting', 'message', 'note')),
  occurred_at timestamptz not null default now(),
  summary text not null check (char_length(btrim(summary)) between 1 and 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, client_id) references public.clients (organization_id, id),
  foreign key (organization_id, client_id, contact_id)
    references public.client_contacts (organization_id, client_id, id) on delete set null (contact_id)
);

create index client_interactions_client_idx on public.client_interactions (organization_id, client_id, occurred_at desc);

create trigger client_interactions_set_updated_at before update on public.client_interactions
  for each row execute function private.set_updated_at();

create table public.client_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  client_id uuid not null,
  project_id uuid,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  url text not null check (char_length(url) <= 2048 and url ~* '^https?://[^[:space:]]+$'),
  kind text not null default 'other' check (kind in ('contract', 'proposal', 'briefing', 'invoice', 'other')),
  notes text check (notes is null or char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, client_id) references public.clients (organization_id, id),
  foreign key (organization_id, project_id) references public.projects (organization_id, id)
);

create index client_documents_client_idx on public.client_documents (organization_id, client_id, created_at desc);

create trigger client_documents_set_updated_at before update on public.client_documents
  for each row execute function private.set_updated_at();

revoke all on public.client_interactions, public.client_documents from public, anon, authenticated;
grant select on public.client_interactions, public.client_documents to authenticated;

grant insert (organization_id, client_id, contact_id, kind, occurred_at, summary)
  on public.client_interactions to authenticated;
grant update (contact_id, kind, occurred_at, summary) on public.client_interactions to authenticated;
grant delete on public.client_interactions to authenticated;

grant insert (organization_id, client_id, project_id, title, url, kind, notes)
  on public.client_documents to authenticated;
grant update (project_id, title, url, kind, notes) on public.client_documents to authenticated;
grant delete on public.client_documents to authenticated;

alter table public.client_interactions enable row level security;
alter table public.client_documents enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['client_interactions', 'client_documents']
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
    execute format(
      'create policy %I on public.%I for delete to authenticated using (private.is_active_owner(organization_id))',
      t || '_delete_owner', t);
    execute format(
      'create policy mfa_required on public.%I as restrictive for all to authenticated '
      'using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()))', t);
  end loop;
end $$;

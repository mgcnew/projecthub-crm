-- Diretório de acessos (D086): onde estão as contas de serviços (painéis, repositórios, e-mail, domínios),
-- com URL, usuário/e-mail e a indicação do item no gerenciador de senhas do próprio usuário.
-- ESTA TABELA NÃO GUARDA SENHAS NEM SEGREDOS: não existe coluna para isso e o texto livre é avisado na UI.
-- Um cofre criptografado seria uma etapa separada (fora do escopo). Sem trilha em activity_logs de propósito.

create table public.access_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid,
  client_id uuid,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  category text check (category is null or char_length(category) <= 60),
  -- Só http(s): a URL é renderizada como link; `javascript:` e similares ficam de fora.
  url text check (url is null or (char_length(url) <= 2048 and url ~* '^https?://[^[:space:]]+$')),
  username text check (username is null or char_length(username) <= 320),
  manager_item text check (manager_item is null or char_length(manager_item) <= 200),
  notes text check (notes is null or char_length(notes) <= 5000),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, project_id) references public.projects (organization_id, id),
  foreign key (organization_id, client_id) references public.clients (organization_id, id)
);

comment on table public.access_entries is
  'Diretório de acessos. NUNCA guardar senhas, tokens ou chaves aqui: só URL, usuário e onde está o item no gerenciador.';

create index access_entries_org_name_idx on public.access_entries (organization_id, name) where archived_at is null;
create index access_entries_org_project_idx on public.access_entries (organization_id, project_id) where project_id is not null;
create index access_entries_org_client_idx on public.access_entries (organization_id, client_id) where client_id is not null;

create trigger access_entries_set_updated_at before update on public.access_entries
  for each row execute function private.set_updated_at();

revoke all on public.access_entries from public, anon, authenticated;
grant select on public.access_entries to authenticated;
grant insert (organization_id, project_id, client_id, name, category, url, username, manager_item, notes)
  on public.access_entries to authenticated;
grant update (project_id, client_id, name, category, url, username, manager_item, notes, archived_at)
  on public.access_entries to authenticated;
-- Sem histórico de negócio: a remoção definitiva é permitida (como modelos e planos).
grant delete on public.access_entries to authenticated;

alter table public.access_entries enable row level security;

create policy access_entries_select_member on public.access_entries
  for select to authenticated using (private.is_active_member(organization_id));
create policy access_entries_insert_owner on public.access_entries
  for insert to authenticated with check (private.is_active_owner(organization_id));
create policy access_entries_update_owner on public.access_entries
  for update to authenticated
  using (private.is_active_owner(organization_id))
  with check (private.is_active_owner(organization_id));
create policy access_entries_delete_owner on public.access_entries
  for delete to authenticated using (private.is_active_owner(organization_id));

-- D082: com fator TOTP verificado, a sessão só acessa dados em aal2 (teste 008 exige em toda tabela).
create policy mfa_required on public.access_entries as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

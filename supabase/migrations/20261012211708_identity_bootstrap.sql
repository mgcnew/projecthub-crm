-- Fase 1 / provisionamento: perfil + organização pessoal + owner, transacional e idempotente.

create function private.ensure_personal_workspace(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_meta jsonb;
  v_display text;
  v_slug text := 'pessoal-' || p_user_id::text;
  v_org uuid;
begin
  -- Serializa chamadas concorrentes para o mesmo usuário.
  perform pg_advisory_xact_lock(hashtextextended('ensure_personal_workspace:' || p_user_id::text, 0));

  select u.email, coalesce(u.raw_user_meta_data, '{}'::jsonb)
    into v_email, v_meta
    from auth.users u
   where u.id = p_user_id;

  if not found then
    raise exception 'user % not found in auth.users', p_user_id using errcode = '23503';
  end if;

  v_display := left(
    coalesce(
      nullif(btrim(v_meta ->> 'display_name'), ''),
      nullif(btrim(v_meta ->> 'full_name'), ''),
      nullif(split_part(coalesce(v_email, ''), '@', 1), ''),
      'Usuário'
    ),
    120
  );

  insert into public.profiles (id, display_name)
  values (p_user_id, v_display)
  on conflict (id) do nothing;

  insert into public.organizations (name, slug, created_by)
  values ('Espaço pessoal', v_slug, p_user_id)
  on conflict (slug) do nothing;

  select o.id into v_org from public.organizations o where o.slug = v_slug;

  -- Não ressuscita vínculo suspenso/rebaixado: conflito = não faz nada.
  insert into public.organization_members (organization_id, user_id, role, status)
  values (v_org, p_user_id, 'owner', 'active')
  on conflict (organization_id, user_id) do nothing;

  return v_org;
end;
$$;

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.ensure_personal_workspace(new.id);
  return new;
end;
$$;

revoke all on function private.ensure_personal_workspace(uuid) from public, anon, authenticated;
revoke all on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Usuários que já existiam antes desta migração.
select private.ensure_personal_workspace(u.id) from auth.users u;

-- priority_rank (coluna gerada, 20261013150000) é derivada de priority: não deve aparecer no diff da trilha.
-- Só a lista de colunas ignoradas muda; o restante da função é idêntico ao de 20261013130000.
create or replace function private.log_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type text := tg_argv[0];
  v_new jsonb := to_jsonb(new);
  v_old jsonb;
  v_changes jsonb;
  v_action text;
  -- Colunas derivadas ou imutáveis que não contam como alteração (priority_rank é gerada de priority).
  v_ignore text[] := array['updated_at', 'created_at', 'completed_at', 'organization_id', 'id', 'priority_rank'];
  -- Texto longo: registra apenas que mudou.
  v_long text[] := array['description', 'notes'];
begin
  if v_type = 'calendar_event' and v_new->>'event_type' = 'work_block' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    insert into public.activity_logs (organization_id, actor_id, entity_type, entity_id, action, changes)
    values (
      new.organization_id, auth.uid(), v_type, new.id, 'created',
      jsonb_build_object('title', coalesce(v_new->>'title', v_new->>'name'))
    );
    return new;
  end if;

  v_old := to_jsonb(old);
  select coalesce(jsonb_object_agg(
           n.key,
           case when n.key = any (v_long)
                then jsonb_build_object('changed', true)
                else jsonb_build_object('from', o.value, 'to', n.value)
           end), '{}'::jsonb)
    into v_changes
    from jsonb_each(v_new) n
    join jsonb_each(v_old) o on o.key = n.key
   where n.value is distinct from o.value
     and n.key <> all (v_ignore);

  if v_changes = '{}'::jsonb then
    return new;
  end if;

  v_action := case
    when (v_old->>'archived_at') is null and (v_new->>'archived_at') is not null then 'archived'
    when (v_old->>'archived_at') is not null and (v_new->>'archived_at') is null then 'unarchived'
    when v_changes ? 'status' then 'status_changed'
    else 'updated'
  end;

  insert into public.activity_logs (organization_id, actor_id, entity_type, entity_id, action, changes)
  values (new.organization_id, auth.uid(), v_type, new.id, v_action, v_changes);
  return new;
end;
$$;

revoke all on function private.log_activity() from public, anon, authenticated;

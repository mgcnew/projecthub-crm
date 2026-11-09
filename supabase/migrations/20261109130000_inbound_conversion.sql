-- Fase 7.8 (D138–D141): respostas dos leads (inbound_messages), temperatura automática e conversão em cliente.
-- Sem envio nem recebimento automático nesta etapa: as respostas entram à mão (e pelos webhooks da 7.5/7.6).

-- ----------------------------------------------------------- inbound_messages
create table public.inbound_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  -- Casado pelo endereço (e-mail ou telefone) quando não informado; null = resposta que não casou com nenhum lead.
  lead_id uuid,
  channel text not null check (channel in ('email', 'whatsapp')),
  -- O gatilho preenche a partir do lead quando vier vazio.
  from_address text not null default '' check (char_length(from_address) <= 254),
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  received_at timestamptz not null default now(),
  provider_message_id text check (provider_message_id is null or char_length(provider_message_id) <= 200),
  -- Nulo = resposta nova (ainda não vista).
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, lead_id) references public.leads (organization_id, id)
);

create unique index inbound_messages_provider_key on public.inbound_messages (organization_id, provider_message_id)
  where provider_message_id is not null;
create index inbound_messages_unread_idx on public.inbound_messages (organization_id, received_at desc) where read_at is null;
create index inbound_messages_lead_idx on public.inbound_messages (organization_id, lead_id, received_at desc);

create trigger inbound_messages_set_updated_at before update on public.inbound_messages
  for each row execute function private.set_updated_at();

-- Casa a resposta com o lead pelo endereço e preenche o remetente.
create function private.inbound_messages_before()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  l public.leads;
  v_addr text;
begin
  if new.lead_id is null then
    v_addr := case new.channel when 'email' then lower(btrim(new.from_address)) else btrim(new.from_address) end;
    if v_addr <> '' then
      select * into l from public.leads
       where organization_id = new.organization_id and archived_at is null
         and ((new.channel = 'email' and lower(email) = v_addr) or (new.channel = 'whatsapp' and phone = v_addr))
       limit 1;
      if found then
        new.lead_id := l.id;
      end if;
    end if;
  else
    select * into l from public.leads where organization_id = new.organization_id and id = new.lead_id;
    if new.from_address = '' then
      new.from_address := coalesce(case new.channel when 'email' then lower(btrim(l.email)) else l.phone end, '');
    end if;
  end if;
  if new.lead_id is null and new.from_address = '' then
    raise exception 'informe o lead ou o endereço de quem respondeu' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger inbound_messages_before before insert on public.inbound_messages
  for each row execute function private.inbound_messages_before();
revoke all on function private.inbound_messages_before() from public, anon, authenticated;

-- Reage à resposta: lead novo/contatado vira "respondeu" (a temperatura sobe pelo gatilho de leads) e as
-- palavras de saída (SAIR, PARAR…) viram "não contatar", que alimenta a supressão e para as campanhas.
create function private.inbound_messages_after()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_word text := lower(regexp_replace(btrim(new.body), '[[:space:][:punct:]]+$', ''));
begin
  if new.lead_id is null then
    return new;
  end if;
  if v_word in ('sair', 'parar', 'pare', 'stop', 'cancelar', 'remover', 'descadastrar', 'nao quero', 'não quero') then
    update public.leads set opted_out_at = coalesce(opted_out_at, now())
     where organization_id = new.organization_id and id = new.lead_id;
  end if;
  update public.leads set stage = 'replied'
   where organization_id = new.organization_id and id = new.lead_id and stage in ('new', 'contacted');
  return new;
end;
$$;

create trigger inbound_messages_after after insert on public.inbound_messages
  for each row execute function private.inbound_messages_after();
revoke all on function private.inbound_messages_after() from public, anon, authenticated;

-- ------------------------------------------------- temperatura automática do lead
-- Respondeu → morno (se estava frio); reunião ou proposta → quente. Nunca esfria sozinho.
create function private.leads_auto_temperature()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.stage is distinct from old.stage then
    if new.stage in ('meeting', 'proposal') and new.temperature <> 'hot' then
      new.temperature := 'hot';
    elsif new.stage = 'replied' and new.temperature = 'cold' then
      new.temperature := 'warm';
    end if;
  end if;
  return new;
end;
$$;

create trigger leads_auto_temperature before update of stage on public.leads
  for each row execute function private.leads_auto_temperature();
revoke all on function private.leads_auto_temperature() from public, anon, authenticated;

-- ------------------------------------------------------------ conversão em cliente
alter table public.leads add column converted_at timestamptz;

create function private.owner_guard(p_org uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (private.is_active_owner(p_org) and private.mfa_satisfied()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
end;
$$;
revoke all on function private.owner_guard(uuid) from public, anon, authenticated;

-- Converte o lead em cliente: cria (ou vincula) o cliente, o contato principal e, se pedido, um projeto; marca o
-- lead como ganho. Tudo na mesma transação. Devolve o id do cliente.
create function private.convert_lead(p_lead uuid, p_existing_client uuid, p_project_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  l public.leads;
  v_client uuid;
  v_project text := nullif(btrim(coalesce(p_project_name, '')), '');
begin
  select * into l from public.leads where id = p_lead;
  if not found then
    raise exception 'lead não encontrado' using errcode = '23503';
  end if;
  perform private.owner_guard(l.organization_id);
  if l.converted_client_id is not null then
    raise exception 'este lead já foi convertido em cliente' using errcode = '23505';
  end if;

  if p_existing_client is not null then
    if not exists (select 1 from public.clients c where c.organization_id = l.organization_id and c.id = p_existing_client) then
      raise exception 'cliente não encontrado' using errcode = '23503';
    end if;
    v_client := p_existing_client;
  else
    insert into public.clients (organization_id, name, email, phone, website, address_line, address_city, address_state, source, notes)
    values (l.organization_id, l.company_name, lower(btrim(l.email)), l.phone, l.website, l.address_line, l.city, l.state,
            left('Prospecção: ' || l.source, 100), nullif(left(coalesce(l.notes, ''), 10000), ''))
    returning id into v_client;
  end if;

  if l.contact_name is not null and btrim(l.contact_name) <> '' then
    insert into public.client_contacts (organization_id, client_id, name, email, phone, whatsapp, is_primary)
    values (l.organization_id, v_client, l.contact_name, lower(btrim(l.email)), l.phone,
            case when l.has_whatsapp is true then l.phone end,
            not exists (select 1 from public.client_contacts k where k.client_id = v_client and k.is_primary));
  end if;

  if v_project is not null then
    insert into public.projects (organization_id, client_id, name) values (l.organization_id, v_client, v_project);
  end if;

  update public.leads set converted_client_id = v_client, converted_at = now(), stage = 'won' where id = l.id;
  return v_client;
end;
$$;
revoke all on function private.convert_lead(uuid, uuid, text) from public, anon;
grant execute on function private.convert_lead(uuid, uuid, text) to authenticated;

create function public.convert_lead(p_lead uuid, p_existing_client uuid default null, p_project_name text default null)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.convert_lead(p_lead, p_existing_client, p_project_name);
$$;
revoke all on function public.convert_lead(uuid, uuid, text) from public, anon;
grant execute on function public.convert_lead(uuid, uuid, text) to authenticated;

-- ------------------------------------------------------------------ grants
revoke all on public.inbound_messages from public, anon, authenticated;
grant select on public.inbound_messages to authenticated;
-- O cliente registra uma resposta à mão e marca como lida; o remetente vem do lead (ou do webhook, no servidor).
grant insert (organization_id, lead_id, channel, body, received_at) on public.inbound_messages to authenticated;
grant update (read_at) on public.inbound_messages to authenticated;

alter table public.inbound_messages enable row level security;
create policy inbound_messages_select_member on public.inbound_messages
  for select to authenticated using (private.is_active_member(organization_id));
create policy inbound_messages_insert_owner on public.inbound_messages
  for insert to authenticated with check (private.is_active_owner(organization_id));
create policy inbound_messages_update_owner on public.inbound_messages
  for update to authenticated
  using (private.is_active_owner(organization_id))
  with check (private.is_active_owner(organization_id));
create policy mfa_required on public.inbound_messages as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

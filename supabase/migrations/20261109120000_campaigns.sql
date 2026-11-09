-- Fase 7.7 (D133–D137): campanhas e sequências. Campanha = público + sistema + canal + sequência de até 3 passos
-- (1ª mensagem; lembretes em D+3 e D+7 por padrão, contados a partir da 1ª). Nada é enviado: a campanha só
-- produz RASCUNHOS na fila (7.4), que o usuário revisa e aprova. As regras valem no banco:
--   - campanha pausada, encerrada ou em rascunho não gera rascunhos;
--   - lead que respondeu, saiu ("não contatar") ou terminou a sequência não recebe mais nada;
--   - os passos seguem a ordem (1, 2, 3), cada um com o modelo daquele passo e do canal da campanha;
--   - o WhatsApp só entra para lead morno/quente (D105), a supressão vale na inclusão e na geração.

-- ---------------------------------------------------------------- campaigns
create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  product_id uuid,
  channel text not null check (channel in ('email', 'whatsapp')),
  -- Público: em branco = qualquer temperatura (WhatsApp exige morno ou quente, como nos modelos).
  temperature text check (temperature is null or temperature in ('cold', 'warm', 'hot')),
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'finished')),
  daily_limit integer not null default 20 check (daily_limit between 1 and 100),
  -- Dias, a partir da 1ª mensagem, dos lembretes (padrão D+3 e D+7). Até 2 lembretes, em ordem crescente.
  followup_days integer[] not null default '{3,7}'
    check (
      cardinality(followup_days) <= 2
      and (cardinality(followup_days) < 1 or followup_days[1] between 1 and 30)
      and (cardinality(followup_days) < 2 or (followup_days[2] between 2 and 60 and followup_days[2] > followup_days[1]))
    ),
  step1_template_id uuid,
  step2_template_id uuid,
  step3_template_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, product_id) references public.products (organization_id, id),
  foreign key (organization_id, step1_template_id) references public.message_templates (organization_id, id),
  foreign key (organization_id, step2_template_id) references public.message_templates (organization_id, id),
  foreign key (organization_id, step3_template_id) references public.message_templates (organization_id, id),
  check (channel <> 'whatsapp' or coalesce(temperature in ('warm', 'hot'), false)),
  -- Para ativar é preciso ter a 1ª mensagem; os lembretes só existem dentro do que foi configurado.
  check (status = 'draft' or step1_template_id is not null),
  check (step2_template_id is null or cardinality(followup_days) >= 1),
  check (step3_template_id is null or cardinality(followup_days) >= 2)
);

create index campaigns_org_status_idx on public.campaigns (organization_id, status);

create trigger campaigns_set_updated_at before update on public.campaigns
  for each row execute function private.set_updated_at();

-- Cada passo usa um modelo daquele passo e do canal da campanha; transições de status válidas.
create function private.campaigns_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slot record;
  v_tpl public.message_templates;
begin
  for v_slot in
    select 1 as step, new.step1_template_id as tid
    union all select 2, new.step2_template_id
    union all select 3, new.step3_template_id
  loop
    if v_slot.tid is not null then
      select * into v_tpl from public.message_templates where organization_id = new.organization_id and id = v_slot.tid;
      if v_tpl.step is distinct from v_slot.step or v_tpl.channel is distinct from new.channel then
        raise exception 'o modelo do passo % precisa ser do passo % e do canal da campanha', v_slot.step, v_slot.step
          using errcode = '23514';
      end if;
    end if;
  end loop;

  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if (old.status, new.status) not in (
      ('draft', 'active'), ('draft', 'finished'),
      ('active', 'paused'), ('active', 'finished'),
      ('paused', 'active'), ('paused', 'finished')
    ) then
      raise exception 'transição de campanha inválida: % → %', old.status, new.status using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger campaigns_guard before insert or update on public.campaigns
  for each row execute function private.campaigns_guard();
revoke all on function private.campaigns_guard() from public, anon, authenticated;

-- ---------------------------------------------------------- campaign_leads
create table public.campaign_leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  campaign_id uuid not null,
  lead_id uuid not null,
  -- Último passo já gerado (0 = nenhum ainda).
  step smallint not null default 0 check (step between 0 and 3),
  status text not null default 'active' check (status in ('active', 'replied', 'finished', 'opted_out', 'failed')),
  started_on date,
  next_step_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (campaign_id, lead_id),
  foreign key (organization_id, campaign_id) references public.campaigns (organization_id, id),
  foreign key (organization_id, lead_id) references public.leads (organization_id, id)
);

create index campaign_leads_due_idx on public.campaign_leads (organization_id, next_step_on) where status = 'active';
create index campaign_leads_lead_idx on public.campaign_leads (organization_id, lead_id);

create trigger campaign_leads_set_updated_at before update on public.campaign_leads
  for each row execute function private.set_updated_at();

create function private.campaign_leads_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.campaigns;
  l public.leads;
  -- "Servidor": sem usuário no JWT, ou uma troca feita pelo próprio sistema (gatilho de leads, marcada abaixo).
  v_server boolean := (select auth.uid()) is null or coalesce(current_setting('app.campaign_system', true), '') = 'on';
begin
  if tg_op = 'INSERT' then
    select * into c from public.campaigns where organization_id = new.organization_id and id = new.campaign_id;
    if c.status = 'finished' then
      raise exception 'campanha encerrada não recebe leads' using errcode = '23514';
    end if;
    -- Mesmas regras da fila: arquivado, "não contatar", sem endereço no canal, supressão, WhatsApp só morno/quente.
    perform private.outbound_check_lead(new.organization_id, new.lead_id, c.channel);
    select * into l from public.leads where organization_id = new.organization_id and id = new.lead_id;
    if c.temperature is not null and l.temperature <> c.temperature then
      raise exception 'a temperatura do lead não é o público desta campanha' using errcode = '23514';
    end if;
    if not v_server then
      new.step := 0; new.status := 'active'; new.started_on := null; new.next_step_on := null;
    end if;
    return new;
  end if;

  if new.campaign_id is distinct from old.campaign_id or new.lead_id is distinct from old.lead_id then
    raise exception 'campanha e lead não mudam' using errcode = '23514';
  end if;
  if new.status is distinct from old.status then
    if not v_server then
      -- O usuário só marca "respondeu", "encerrado" ou retoma; saída e falha vêm do sistema.
      if (old.status, new.status) not in (('active', 'replied'), ('active', 'finished'), ('replied', 'active')) then
        raise exception 'transição não permitida: % → %', old.status, new.status using errcode = '23514';
      end if;
    end if;
    if new.status <> 'active' then
      new.next_step_on := null;
    end if;
  end if;
  return new;
end;
$$;

create trigger campaign_leads_guard before insert or update on public.campaign_leads
  for each row execute function private.campaign_leads_guard();
revoke all on function private.campaign_leads_guard() from public, anon, authenticated;

-- O lead pediu para sair, respondeu ou avançou/perdeu no funil: a sequência dele para.
create function private.leads_sync_campaigns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- A troca de status é do sistema (o lead saiu ou respondeu), não do usuário: o guarda das campanhas deixa passar.
  perform set_config('app.campaign_system', 'on', true);
  if new.opted_out_at is not null and old.opted_out_at is null then
    update public.campaign_leads set status = 'opted_out', next_step_on = null
     where organization_id = new.organization_id and lead_id = new.id and status in ('active', 'replied');
  elsif new.stage is distinct from old.stage then
    if new.stage in ('replied', 'meeting', 'proposal', 'won') then
      update public.campaign_leads set status = 'replied', next_step_on = null
       where organization_id = new.organization_id and lead_id = new.id and status = 'active';
    elsif new.stage = 'lost' then
      update public.campaign_leads set status = 'finished', next_step_on = null
       where organization_id = new.organization_id and lead_id = new.id and status = 'active';
    end if;
  end if;
  perform set_config('app.campaign_system', '', true);
  return new;
end;
$$;

create trigger leads_sync_campaigns after update of opted_out_at, stage on public.leads
  for each row execute function private.leads_sync_campaigns();
revoke all on function private.leads_sync_campaigns() from public, anon, authenticated;

-- ------------------------------------------------- outbound_messages.campaign_id
alter table public.outbound_messages add column campaign_id uuid;
alter table public.outbound_messages add foreign key (organization_id, campaign_id) references public.campaigns (organization_id, id);
create index outbound_messages_campaign_idx on public.outbound_messages (organization_id, campaign_id) where campaign_id is not null;
grant insert (campaign_id) on public.outbound_messages to authenticated;

-- Rascunho de campanha: campanha ativa, lead ainda na sequência, passo na ordem e modelo certo.
create function private.outbound_campaign_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.campaigns;
  cl public.campaign_leads;
  v_step smallint;
  v_expected uuid;
begin
  if new.campaign_id is null then
    return new;
  end if;
  select * into c from public.campaigns where organization_id = new.organization_id and id = new.campaign_id;
  if c.status <> 'active' then
    raise exception 'campanha % não gera rascunhos',
      case c.status when 'paused' then 'pausada' when 'finished' then 'encerrada' else 'ainda em rascunho' end
      using errcode = '23514';
  end if;
  if new.channel <> c.channel then
    raise exception 'o canal da mensagem não é o da campanha' using errcode = '23514';
  end if;
  select * into cl from public.campaign_leads
   where organization_id = new.organization_id and campaign_id = new.campaign_id and lead_id = new.lead_id;
  if not found then
    raise exception 'o lead não está nesta campanha' using errcode = '23514';
  end if;
  if cl.status <> 'active' then
    raise exception 'o lead respondeu, saiu ou terminou a sequência: sem novos rascunhos' using errcode = '23514';
  end if;
  select m.step into v_step from public.message_templates m where m.organization_id = new.organization_id and m.id = new.template_id;
  if v_step is null then
    raise exception 'mensagem de campanha precisa de um modelo' using errcode = '23514';
  end if;
  v_expected := case v_step when 1 then c.step1_template_id when 2 then c.step2_template_id else c.step3_template_id end;
  if v_expected is distinct from new.template_id then
    raise exception 'este modelo não é o do passo % da campanha', v_step using errcode = '23514';
  end if;
  if v_step <> cl.step + 1 then
    raise exception 'os passos seguem a ordem: o próximo é o %', cl.step + 1 using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger outbound_messages_campaign before insert on public.outbound_messages
  for each row execute function private.outbound_campaign_guard();
revoke all on function private.outbound_campaign_guard() from public, anon, authenticated;

-- Depois do rascunho: o lead avança de passo e a data do próximo lembrete é calculada a partir da 1ª mensagem.
create function private.outbound_campaign_advance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.campaigns;
  v_step smallint;
  v_start date;
  v_max integer;
begin
  if new.campaign_id is null then
    return new;
  end if;
  select * into c from public.campaigns where organization_id = new.organization_id and id = new.campaign_id;
  select m.step into v_step from public.message_templates m where m.organization_id = new.organization_id and m.id = new.template_id;
  select coalesce(started_on, current_date) into v_start from public.campaign_leads
   where organization_id = new.organization_id and campaign_id = new.campaign_id and lead_id = new.lead_id;
  v_max := 1 + cardinality(c.followup_days);
  update public.campaign_leads
     set step = v_step,
         started_on = v_start,
         next_step_on = case when v_step < v_max then v_start + c.followup_days[v_step] else null end,
         status = case when v_step >= v_max then 'finished' else status end
   where organization_id = new.organization_id and campaign_id = new.campaign_id and lead_id = new.lead_id;
  return new;
end;
$$;

create trigger outbound_messages_campaign_advance after insert on public.outbound_messages
  for each row execute function private.outbound_campaign_advance();
revoke all on function private.outbound_campaign_advance() from public, anon, authenticated;

-- ------------------------------------------------------------------ grants
revoke all on public.campaigns, public.campaign_leads from public, anon, authenticated;
grant select on public.campaigns, public.campaign_leads to authenticated;
grant insert (organization_id, name, product_id, channel, temperature, daily_limit, followup_days,
              step1_template_id, step2_template_id, step3_template_id)
  on public.campaigns to authenticated;
-- Canal e público não mudam depois de criada (os leads já foram escolhidos por eles).
grant update (name, product_id, status, daily_limit, followup_days, step1_template_id, step2_template_id, step3_template_id)
  on public.campaigns to authenticated;
grant insert (organization_id, campaign_id, lead_id) on public.campaign_leads to authenticated;
grant update (status) on public.campaign_leads to authenticated;

alter table public.campaigns enable row level security;
alter table public.campaign_leads enable row level security;

create policy campaigns_select_member on public.campaigns
  for select to authenticated using (private.is_active_member(organization_id));
create policy campaigns_insert_owner on public.campaigns
  for insert to authenticated with check (private.is_active_owner(organization_id));
create policy campaigns_update_owner on public.campaigns
  for update to authenticated
  using (private.is_active_owner(organization_id))
  with check (private.is_active_owner(organization_id));

create policy campaign_leads_select_member on public.campaign_leads
  for select to authenticated using (private.is_active_member(organization_id));
create policy campaign_leads_insert_owner on public.campaign_leads
  for insert to authenticated with check (private.is_active_owner(organization_id));
create policy campaign_leads_update_owner on public.campaign_leads
  for update to authenticated
  using (private.is_active_owner(organization_id))
  with check (private.is_active_owner(organization_id));

do $$
declare
  t text;
begin
  foreach t in array array['campaigns', 'campaign_leads']
  loop
    execute format(
      'create policy mfa_required on public.%I as restrictive for all to authenticated '
      'using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()))', t);
  end loop;
end $$;

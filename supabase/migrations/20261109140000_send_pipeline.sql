-- Fase 7.5/7.6 (D143–D148): suporte do banco ao envio. O envio é feito por uma Edge Function (service_role) que
-- pega o lote de mensagens APROVADAS aqui, chama o provedor (Resend ou Evolution) e devolve o resultado.
-- As regras valem no banco, na hora de pegar cada mensagem: campanha/lead ainda elegível (supressão, "não
-- contatar"), configuração ativa e não pausada, janela de horário, dias úteis, limite diário do canal e, no
-- WhatsApp, conexão aberta e intervalo aleatório de 60 a 240 s entre mensagens.

create extension if not exists pg_net;

-- --------------------------------------------------------------- configuração
alter table public.outreach_settings
  add column timezone text not null default 'America/Sao_Paulo' check (char_length(timezone) between 1 and 64),
  add column ai_daily_limit integer not null default 20 check (ai_daily_limit between 1 and 200),
  -- Preenchidos só pelo servidor (webhook do Evolution e envio).
  add column whatsapp_state text check (whatsapp_state is null or whatsapp_state in ('open', 'connecting', 'close')),
  add column whatsapp_state_at timestamptz,
  add column whatsapp_next_at timestamptz;
-- Quando o servidor pegou a mensagem para enviar (base da contagem diária; o cliente não escreve).
alter table public.outbound_messages add column claimed_at timestamptz;
grant insert (timezone, ai_daily_limit) on public.outreach_settings to authenticated;
grant update (timezone, ai_daily_limit) on public.outreach_settings to authenticated;

-- ---------------------------------------------------- transições de status (envio)
-- Acrescenta: failed → draft (corrigir e reaprovar) para o usuário; sending → approved (nova tentativa) só do servidor.
create or replace function private.outbound_messages_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_server boolean := (select auth.uid()) is null;
  v_ok boolean;
begin
  if tg_op = 'INSERT' then
    if new.status <> 'draft' and not v_server then
      raise exception 'toda mensagem nasce como rascunho' using errcode = '23514';
    end if;
    new.to_address := private.outbound_check_lead(new.organization_id, new.lead_id, new.channel);
    return new;
  end if;

  -- UPDATE
  if new.lead_id is distinct from old.lead_id or new.channel is distinct from old.channel
     or new.to_address is distinct from old.to_address or new.template_id is distinct from old.template_id then
    raise exception 'lead, canal, modelo e destino não mudam' using errcode = '23514';
  end if;
  if old.status = 'sending' and not v_server then
    raise exception 'mensagem em envio: só o servidor altera' using errcode = '23514';
  end if;
  if old.status <> 'draft' and (new.body is distinct from old.body or new.subject is distinct from old.subject) then
    raise exception 'só rascunho pode ser editado (volte para rascunho antes)' using errcode = '23514';
  end if;

  if new.status is distinct from old.status then
    v_ok := (old.status, new.status) in (
      ('draft', 'approved'), ('draft', 'cancelled'),
      ('approved', 'draft'), ('approved', 'cancelled'), ('approved', 'sending'),
      ('sending', 'sent'), ('sending', 'failed'), ('sending', 'approved'),
      ('failed', 'draft')
    );
    if not v_ok then
      raise exception 'transição inválida: % → %', old.status, new.status using errcode = '23514';
    end if;
    if new.status in ('sending', 'sent', 'failed') and not v_server then
      raise exception 'só o servidor marca enviando, enviada ou falhou' using errcode = '23514';
    end if;
    if new.status = 'approved' then
      perform private.outbound_check_lead(new.organization_id, new.lead_id, new.channel);
      new.approved_at := now();
    elsif new.status in ('draft', 'cancelled') then
      new.approved_at := null;
    end if;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------- pegar o lote (envio)
create function private.claim_outbox(p_channel text, p_now timestamptz default now(), p_max integer default 20)
returns table (id uuid, organization_id uuid, lead_id uuid, channel text, to_address text, subject text, body text, attempts integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.outreach_settings;
  m public.outbound_messages;
  v_local timestamp;
  v_day_start timestamptz;
  v_sent_today integer;
  v_remaining integer;
begin
  if p_channel not in ('email', 'whatsapp') then
    raise exception 'canal inválido' using errcode = '22023';
  end if;
  for s in select * from public.outreach_settings o where not o.paused loop
    begin
      v_local := p_now at time zone s.timezone;
    exception when others then
      v_local := p_now at time zone 'UTC';
    end;
    if s.weekdays_only and extract(isodow from v_local) > 5 then continue; end if;
    if v_local::time < s.window_start or v_local::time >= s.window_end then continue; end if;
    v_day_start := date_trunc('day', v_local) at time zone coalesce(nullif(s.timezone, ''), 'UTC');

    select count(*) into v_sent_today from public.outbound_messages om
     where om.organization_id = s.organization_id and om.channel = p_channel and om.status in ('sending', 'sent')
       and coalesce(om.sent_at, om.claimed_at, om.updated_at) >= v_day_start;
    v_remaining := (case p_channel when 'email' then s.email_daily_limit else s.whatsapp_daily_limit end) - v_sent_today;
    if v_remaining <= 0 then continue; end if;

    if p_channel = 'whatsapp' then
      -- Só com a conexão aberta, no máximo 1 por rodada e respeitando o intervalo aleatório de 60 a 240 s.
      if coalesce(s.whatsapp_state, '') <> 'open' then continue; end if;
      if s.whatsapp_next_at is not null and s.whatsapp_next_at > p_now then continue; end if;
      v_remaining := 1;
    end if;

    for m in
      select om.* from public.outbound_messages om
       where om.organization_id = s.organization_id and om.channel = p_channel and om.status = 'approved'
         and (om.scheduled_for is null or om.scheduled_for <= p_now)
       order by om.approved_at, om.created_at
       limit least(v_remaining, p_max)
       for update skip locked
    loop
      begin
        perform private.outbound_check_lead(m.organization_id, m.lead_id, m.channel);
      exception when others then
        -- O lead saiu, foi arquivado ou o endereço entrou na supressão depois da aprovação: não envia.
        update public.outbound_messages set status = 'cancelled', last_error = left(sqlerrm, 500) where public.outbound_messages.id = m.id;
        continue;
      end;
      update public.outbound_messages set status = 'sending', attempts = public.outbound_messages.attempts + 1, claimed_at = p_now where public.outbound_messages.id = m.id;
      return query select m.id, m.organization_id, m.lead_id, m.channel, m.to_address, m.subject, m.body, m.attempts + 1;
    end loop;
  end loop;
end;
$$;

-- Resultado do envio: enviada, nova tentativa (até 3, com espera de 5 min × tentativa) ou falhou.
create function private.finish_outbox(
  p_id uuid, p_ok boolean, p_provider text, p_message_id text, p_error text,
  p_retry boolean default false, p_now timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.outbound_messages;
begin
  select * into m from public.outbound_messages where public.outbound_messages.id = p_id and status = 'sending' for update;
  if not found then
    return;
  end if;
  if p_ok then
    update public.outbound_messages
       set status = 'sent', sent_at = p_now, provider = left(p_provider, 40), provider_message_id = left(p_message_id, 200), last_error = null
     where public.outbound_messages.id = p_id;
    update public.leads set stage = 'contacted' where organization_id = m.organization_id and public.leads.id = m.lead_id and stage = 'new';
    if m.channel = 'whatsapp' then
      update public.outreach_settings set whatsapp_next_at = p_now + (60 + floor(random() * 181)) * interval '1 second'
       where organization_id = m.organization_id;
    end if;
  elsif p_retry and m.attempts < 3 then
    update public.outbound_messages
       set status = 'approved', scheduled_for = p_now + (m.attempts * 5) * interval '1 minute', last_error = left(coalesce(p_error, 'erro'), 500)
     where public.outbound_messages.id = p_id;
  else
    update public.outbound_messages
       set status = 'failed', provider = left(p_provider, 40), last_error = left(coalesce(p_error, 'erro'), 500)
     where public.outbound_messages.id = p_id;
  end if;
end;
$$;

-- ----------------------------------------------- saída e supressão (webhooks e link)
-- O lead pediu para sair: "não contatar" (alimenta a supressão e as campanhas) e cancela o que estava pendente.
create function private.unsubscribe_lead(p_org uuid, p_lead uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.leads set opted_out_at = coalesce(opted_out_at, now()) where organization_id = p_org and public.leads.id = p_lead;
  update public.outbound_messages set status = 'cancelled', last_error = 'lead pediu para sair'
   where organization_id = p_org and lead_id = p_lead and status in ('draft', 'approved');
end;
$$;

-- Bounce ou reclamação do provedor: o endereço entra na lista de supressão e as pendentes são canceladas.
create function private.suppress_address(p_org uuid, p_channel text, p_value text, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v text := lower(btrim(p_value));
begin
  if p_channel not in ('email', 'whatsapp', 'all') or p_reason not in ('opt_out', 'bounce', 'complaint', 'manual') then
    raise exception 'parâmetros inválidos' using errcode = '22023';
  end if;
  insert into public.suppression_list (organization_id, channel, value, reason) values (p_org, p_channel, v, p_reason)
  on conflict (organization_id, channel, value) do nothing;
  update public.outbound_messages set status = 'cancelled', last_error = 'endereço na supressão'
   where organization_id = p_org and lower(to_address) = v and status in ('draft', 'approved')
     and (p_channel = 'all' or channel = p_channel);
end;
$$;

-- Estado da conexão do WhatsApp (webhook do Evolution).
create function private.set_whatsapp_state(p_org uuid, p_state text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_state not in ('open', 'connecting', 'close') then
    raise exception 'estado inválido' using errcode = '22023';
  end if;
  update public.outreach_settings set whatsapp_state = p_state, whatsapp_state_at = now() where organization_id = p_org;
end;
$$;

-- ----------------------------------------------- funções expostas (só service_role)
-- A API só enxerga o schema public: wrappers SECURITY INVOKER chamam as funções privilegiadas de private.
grant usage on schema private to service_role;
revoke all on function private.claim_outbox(text, timestamptz, integer) from public, anon, authenticated;
revoke all on function private.finish_outbox(uuid, boolean, text, text, text, boolean, timestamptz) from public, anon, authenticated;
revoke all on function private.unsubscribe_lead(uuid, uuid) from public, anon, authenticated;
revoke all on function private.suppress_address(uuid, text, text, text) from public, anon, authenticated;
revoke all on function private.set_whatsapp_state(uuid, text) from public, anon, authenticated;
grant execute on function private.claim_outbox(text, timestamptz, integer) to service_role;
grant execute on function private.finish_outbox(uuid, boolean, text, text, text, boolean, timestamptz) to service_role;
grant execute on function private.unsubscribe_lead(uuid, uuid) to service_role;
grant execute on function private.suppress_address(uuid, text, text, text) to service_role;
grant execute on function private.set_whatsapp_state(uuid, text) to service_role;

create function public.outbox_claim(p_channel text, p_max integer default 20)
returns table (id uuid, organization_id uuid, lead_id uuid, channel text, to_address text, subject text, body text, attempts integer)
language sql security invoker set search_path = ''
as $$ select * from private.claim_outbox(p_channel, now(), p_max); $$;

create function public.outbox_finish(p_id uuid, p_ok boolean, p_provider text, p_message_id text, p_error text, p_retry boolean default false)
returns void
language sql security invoker set search_path = ''
as $$ select private.finish_outbox(p_id, p_ok, p_provider, p_message_id, p_error, p_retry, now()); $$;

create function public.outbox_unsubscribe(p_org uuid, p_lead uuid)
returns void
language sql security invoker set search_path = ''
as $$ select private.unsubscribe_lead(p_org, p_lead); $$;

create function public.outbox_suppress(p_org uuid, p_channel text, p_value text, p_reason text)
returns void
language sql security invoker set search_path = ''
as $$ select private.suppress_address(p_org, p_channel, p_value, p_reason); $$;

create function public.outbox_whatsapp_state(p_org uuid, p_state text)
returns void
language sql security invoker set search_path = ''
as $$ select private.set_whatsapp_state(p_org, p_state); $$;

revoke all on function public.outbox_claim(text, integer) from public, anon, authenticated;
revoke all on function public.outbox_finish(uuid, boolean, text, text, text, boolean) from public, anon, authenticated;
revoke all on function public.outbox_unsubscribe(uuid, uuid) from public, anon, authenticated;
revoke all on function public.outbox_suppress(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.outbox_whatsapp_state(uuid, text) from public, anon, authenticated;
grant execute on function public.outbox_claim(text, integer) to service_role;
grant execute on function public.outbox_finish(uuid, boolean, text, text, text, boolean) to service_role;
grant execute on function public.outbox_unsubscribe(uuid, uuid) to service_role;
grant execute on function public.outbox_suppress(uuid, text, text, text) to service_role;
grant execute on function public.outbox_whatsapp_state(uuid, text) to service_role;

-- ------------------------------------------------------------------ agendador
-- A cada minuto o pg_cron chama a Edge Function `send-outbox` pelo pg_net. A URL e o segredo ficam no Vault
-- (nomes `send_outbox_url` e `cron_secret`, criados pelo usuário); sem eles a rotina não faz nada.
create function private.invoke_send_outbox()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  select s.decrypted_secret into v_url from vault.decrypted_secrets s where s.name = 'send_outbox_url';
  select s.decrypted_secret into v_secret from vault.decrypted_secrets s where s.name = 'cron_secret';
  if v_url is null or v_secret is null then
    return;
  end if;
  -- Só chama quando há algo aprovado para sair (evita uma chamada por minuto à toa).
  if not exists (select 1 from public.outbound_messages where status = 'approved' and (scheduled_for is null or scheduled_for <= now())) then
    return;
  end if;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
end;
$$;
revoke all on function private.invoke_send_outbox() from public, anon, authenticated;

select cron.schedule('send-outbox', '* * * * *', $$select private.invoke_send_outbox()$$);

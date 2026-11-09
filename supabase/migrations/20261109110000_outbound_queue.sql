-- Fase 7.4 (D129–D132): fila de mensagens com aprovação, SEM envio real. Os rascunhos nascem de um modelo
-- (lead × modelo), são revisados, editados e aprovados na tela; o envio (7.5/7.6) lê só as aprovadas.
-- As regras valem no banco, não só na tela:
--   - WhatsApp só para lead morno ou quente (D105);
--   - lead com "não contatar", arquivado ou com o endereço na lista de supressão não gera rascunho nem é aprovado;
--   - transições de status válidas; só o servidor (sem usuário) marca enviando/enviada/falhou;
--   - só rascunho se edita; o endereço de destino vem do lead, nunca do cliente.
-- Assunto, corpo e endereço ficam fora de activity_logs (esta tabela não tem gatilho de auditoria).

create table public.outbound_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  lead_id uuid not null,
  template_id uuid,
  channel text not null check (channel in ('email', 'whatsapp')),
  -- Preenchido pelo gatilho a partir do lead (e-mail minúsculo ou telefone E.164); o cliente não escreve.
  -- O default só deixa o campo opcional na API; o gatilho sempre o substitui (e o CHECK exige o valor final).
  to_address text not null default '' check (char_length(to_address) between 3 and 254),
  subject text,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  status text not null default 'draft'
    check (status in ('draft', 'approved', 'sending', 'sent', 'failed', 'cancelled')),
  approved_at timestamptz,
  scheduled_for timestamptz,
  sent_at timestamptz,
  provider text check (provider is null or char_length(provider) <= 40),
  provider_message_id text check (provider_message_id is null or char_length(provider_message_id) <= 200),
  attempts integer not null default 0 check (attempts >= 0),
  last_error text check (last_error is null or char_length(last_error) <= 500),
  generated_by text not null default 'template' check (generated_by in ('template', 'ai')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, lead_id) references public.leads (organization_id, id),
  foreign key (organization_id, template_id) references public.message_templates (organization_id, id),
  check (
    (channel = 'whatsapp' and subject is null)
    or (channel = 'email' and subject is not null and char_length(btrim(subject)) between 1 and 200)
  )
);

-- Um lead não recebe o mesmo modelo duas vezes ao mesmo tempo (rascunho, aprovada ou enviando).
create unique index outbound_messages_open_key on public.outbound_messages (organization_id, lead_id, template_id)
  where template_id is not null and status in ('draft', 'approved', 'sending');
create index outbound_messages_status_idx on public.outbound_messages (organization_id, status, created_at desc);
create index outbound_messages_lead_idx on public.outbound_messages (organization_id, lead_id);

create trigger outbound_messages_set_updated_at before update on public.outbound_messages
  for each row execute function private.set_updated_at();

-- Confere se o lead pode receber a mensagem pelo canal (insere o rascunho e também na aprovação).
create function private.outbound_check_lead(p_org uuid, p_lead uuid, p_channel text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  l public.leads;
  v_address text;
begin
  select * into l from public.leads where organization_id = p_org and id = p_lead;
  if not found then
    raise exception 'lead não encontrado' using errcode = '23503';
  end if;
  if l.archived_at is not null then
    raise exception 'lead arquivado não recebe mensagens' using errcode = '23514';
  end if;
  if l.opted_out_at is not null then
    raise exception 'lead pediu para não ser contatado' using errcode = '23514';
  end if;
  if p_channel = 'whatsapp' and l.temperature not in ('warm', 'hot') then
    raise exception 'WhatsApp só para lead morno ou quente' using errcode = '23514';
  end if;
  v_address := case p_channel when 'email' then lower(btrim(l.email)) else l.phone end;
  if v_address is null or v_address = '' then
    raise exception 'lead sem % para este canal', case p_channel when 'email' then 'e-mail' else 'telefone' end
      using errcode = '23514';
  end if;
  if exists (
    select 1 from public.suppression_list s
     where s.organization_id = p_org and s.value = v_address and s.channel in (p_channel, 'all')
  ) then
    raise exception 'endereço na lista de supressão (nunca contatar)' using errcode = '23514';
  end if;
  return v_address;
end;
$$;

create function private.outbound_messages_guard()
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
  if old.status <> 'draft' and (new.body is distinct from old.body or new.subject is distinct from old.subject) then
    raise exception 'só rascunho pode ser editado (volte para rascunho antes)' using errcode = '23514';
  end if;

  if new.status is distinct from old.status then
    v_ok := (old.status, new.status) in (
      ('draft', 'approved'), ('draft', 'cancelled'),
      ('approved', 'draft'), ('approved', 'cancelled'), ('approved', 'sending'),
      ('sending', 'sent'), ('sending', 'failed')
    );
    if not v_ok then
      raise exception 'transição inválida: % → %', old.status, new.status using errcode = '23514';
    end if;
    if new.status in ('sending', 'sent', 'failed') and not v_server then
      raise exception 'só o servidor marca enviando, enviada ou falhou' using errcode = '23514';
    end if;
    if new.status = 'approved' then
      -- O lead pode ter pedido para sair, sido arquivado ou entrado na supressão depois do rascunho.
      perform private.outbound_check_lead(new.organization_id, new.lead_id, new.channel);
      new.approved_at := now();
    elsif new.status in ('draft', 'cancelled') then
      new.approved_at := null;
    end if;
  end if;
  return new;
end;
$$;

create trigger outbound_messages_guard before insert or update on public.outbound_messages
  for each row execute function private.outbound_messages_guard();
revoke all on function private.outbound_check_lead(uuid, uuid, text) from public, anon, authenticated;
revoke all on function private.outbound_messages_guard() from public, anon, authenticated;

-- ------------------------------------------------------------------ grants
revoke all on public.outbound_messages from public, anon, authenticated;
grant select on public.outbound_messages to authenticated;
-- O cliente cria rascunhos e edita assunto, corpo e status (aprovar/cancelar); o resto é do servidor.
grant insert (organization_id, lead_id, template_id, channel, subject, body) on public.outbound_messages to authenticated;
grant update (subject, body, status) on public.outbound_messages to authenticated;

alter table public.outbound_messages enable row level security;

create policy outbound_messages_select_member on public.outbound_messages
  for select to authenticated using (private.is_active_member(organization_id));
create policy outbound_messages_insert_owner on public.outbound_messages
  for insert to authenticated with check (private.is_active_owner(organization_id));
create policy outbound_messages_update_owner on public.outbound_messages
  for update to authenticated
  using (private.is_active_owner(organization_id))
  with check (private.is_active_owner(organization_id));

create policy mfa_required on public.outbound_messages as restrictive for all to authenticated
  using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()));

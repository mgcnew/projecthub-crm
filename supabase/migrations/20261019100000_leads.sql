-- Fase 7.1 (D104–D110): leads da prospecção, lista de supressão (nunca contatar) e configuração de envio.
-- Sem envio nesta etapa. Mesmo padrão do CRM: FK composta, RLS (leitura de membro, escrita só do owner),
-- privilégios por coluna e mfa_required. Leads não entram em activity_logs (dados de contato).

-- ------------------------------------------------------------------ leads
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  company_name text not null check (char_length(btrim(company_name)) between 1 and 200),
  contact_name text check (contact_name is null or char_length(contact_name) <= 200),
  -- E-mail sempre minúsculo (trigger) para o único por organização valer sem diferença de caixa.
  email text check (email is null or (char_length(email) <= 254 and email like '%_@_%')),
  -- Telefone em E.164 (+5511912345678); a normalização é do front, o banco só aceita o formato final.
  phone text check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$'),
  -- Preenchidos pelo servidor na 7.6 (checagem no Evolution); o cliente não escreve.
  has_whatsapp boolean,
  whatsapp_checked_at timestamptz,
  website text check (website is null or (char_length(website) <= 2048 and website ~* '^https?://[^[:space:]]+$')),
  address_line text check (address_line is null or char_length(address_line) <= 300),
  city text check (city is null or char_length(city) <= 100),
  state text check (state is null or char_length(state) <= 60),
  segment text check (segment is null or char_length(segment) <= 100),
  -- Origem obrigatória (LGPD: de onde veio o dado).
  source text not null check (char_length(btrim(source)) between 1 and 200),
  temperature text not null default 'cold' check (temperature in ('cold', 'warm', 'hot')),
  stage text not null default 'new'
    check (stage in ('new', 'contacted', 'replied', 'meeting', 'proposal', 'won', 'lost')),
  lost_reason text check (lost_reason is null or char_length(lost_reason) <= 300),
  -- Gancho de personalização: algo específico do lead (site, segmento, dor).
  hook text check (hook is null or char_length(hook) <= 500),
  notes text check (notes is null or char_length(notes) <= 5000),
  next_contact_on date,
  converted_client_id uuid,
  opted_out_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, converted_client_id) references public.clients (organization_id, id)
);

create unique index leads_org_email_key on public.leads (organization_id, email) where email is not null;
create unique index leads_org_phone_key on public.leads (organization_id, phone) where phone is not null;
create index leads_org_list_idx on public.leads (organization_id, temperature, stage) where archived_at is null;
create index leads_org_company_idx on public.leads (organization_id, company_name);

create function private.leads_normalize()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.email := nullif(lower(btrim(new.email)), '');
  return new;
end;
$$;

create trigger leads_normalize before insert or update of email on public.leads
  for each row execute function private.leads_normalize();

create trigger leads_set_updated_at before update on public.leads
  for each row execute function private.set_updated_at();

-- ------------------------------------------------------------ suppression
create table public.suppression_list (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  channel text not null check (channel in ('email', 'whatsapp', 'all')),
  -- E-mail minúsculo ou telefone E.164.
  value text not null check (char_length(value) between 3 and 254 and value = lower(btrim(value))),
  reason text not null check (reason in ('opt_out', 'bounce', 'complaint', 'manual')),
  created_at timestamptz not null default now(),
  unique (organization_id, channel, value)
);

-- Marcar o lead como "não contatar" suprime o e-mail e o telefone dele em todos os canais.
create function private.leads_suppress_on_opt_out()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.opted_out_at is not null and (tg_op = 'INSERT' or old.opted_out_at is null) then
    if new.email is not null then
      insert into public.suppression_list (organization_id, channel, value, reason)
      values (new.organization_id, 'all', new.email, 'manual')
      on conflict (organization_id, channel, value) do nothing;
    end if;
    if new.phone is not null then
      insert into public.suppression_list (organization_id, channel, value, reason)
      values (new.organization_id, 'all', new.phone, 'manual')
      on conflict (organization_id, channel, value) do nothing;
    end if;
  end if;
  return new;
end;
$$;

create trigger leads_suppress_on_opt_out after insert or update of opted_out_at on public.leads
  for each row execute function private.leads_suppress_on_opt_out();

revoke all on function private.leads_normalize() from public, anon, authenticated;
revoke all on function private.leads_suppress_on_opt_out() from public, anon, authenticated;

-- ------------------------------------------------------ outreach_settings
create table public.outreach_settings (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  email_from text check (email_from is null or (char_length(email_from) <= 254 and email_from like '%_@_%')),
  email_reply_to text check (email_reply_to is null or (char_length(email_reply_to) <= 254 and email_reply_to like '%_@_%')),
  -- Plano grátis do Resend: 100/dia (D106); padrão conservador de 50.
  email_daily_limit integer not null default 50 check (email_daily_limit between 1 and 100),
  -- Número da empresa (D107): padrão conservador de 20 conversas novas por dia.
  whatsapp_daily_limit integer not null default 20 check (whatsapp_daily_limit between 1 and 100),
  window_start time not null default '09:00',
  window_end time not null default '18:00',
  weekdays_only boolean not null default true,
  paused boolean not null default false,
  draft_provider text not null default 'none' check (draft_provider in ('none', 'deepseek')),
  updated_at timestamptz not null default now(),
  check (window_end > window_start)
);

create trigger outreach_settings_set_updated_at before update on public.outreach_settings
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------- grants
revoke all on public.leads, public.suppression_list, public.outreach_settings from public, anon, authenticated;
grant select on public.leads, public.suppression_list, public.outreach_settings to authenticated;

grant insert (organization_id, company_name, contact_name, email, phone, website, address_line, city, state,
              segment, source, temperature, stage, lost_reason, hook, notes, next_contact_on, opted_out_at)
  on public.leads to authenticated;
grant update (company_name, contact_name, email, phone, website, address_line, city, state, segment, source,
              temperature, stage, lost_reason, hook, notes, next_contact_on, opted_out_at, archived_at)
  on public.leads to authenticated;

grant insert (organization_id, channel, value, reason) on public.suppression_list to authenticated;
grant delete on public.suppression_list to authenticated;

grant insert (organization_id, email_from, email_reply_to, email_daily_limit, whatsapp_daily_limit, window_start,
              window_end, weekdays_only, paused, draft_provider)
  on public.outreach_settings to authenticated;
grant update (email_from, email_reply_to, email_daily_limit, whatsapp_daily_limit, window_start, window_end,
              weekdays_only, paused, draft_provider)
  on public.outreach_settings to authenticated;

-- ------------------------------------------------------------------- RLS
alter table public.leads enable row level security;
alter table public.suppression_list enable row level security;
alter table public.outreach_settings enable row level security;

create policy leads_select_member on public.leads
  for select to authenticated using (private.is_active_member(organization_id));
create policy leads_insert_owner on public.leads
  for insert to authenticated with check (private.is_active_owner(organization_id));
create policy leads_update_owner on public.leads
  for update to authenticated
  using (private.is_active_owner(organization_id))
  with check (private.is_active_owner(organization_id));

create policy suppression_list_select_member on public.suppression_list
  for select to authenticated using (private.is_active_member(organization_id));
-- O cliente só registra e desfaz supressões manuais; saída pedida pelo lead, bounce e reclamação vêm do
-- servidor (7.5/7.6) e não são apagadas pela tela.
create policy suppression_list_insert_owner on public.suppression_list
  for insert to authenticated
  with check (private.is_active_owner(organization_id) and reason = 'manual');
create policy suppression_list_delete_owner on public.suppression_list
  for delete to authenticated
  using (private.is_active_owner(organization_id) and reason = 'manual');

create policy outreach_settings_select_member on public.outreach_settings
  for select to authenticated using (private.is_active_member(organization_id));
create policy outreach_settings_insert_owner on public.outreach_settings
  for insert to authenticated with check (private.is_active_owner(organization_id));
create policy outreach_settings_update_owner on public.outreach_settings
  for update to authenticated
  using (private.is_active_owner(organization_id))
  with check (private.is_active_owner(organization_id));

do $$
declare
  t text;
begin
  foreach t in array array['leads', 'suppression_list', 'outreach_settings']
  loop
    execute format(
      'create policy mfa_required on public.%I as restrictive for all to authenticated '
      'using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()))', t);
  end loop;
end $$;

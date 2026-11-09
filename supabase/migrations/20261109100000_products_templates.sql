-- Fase 7.3 (D126–D128): catálogo de sistemas (products) e modelos de mensagem (message_templates), mais o
-- sistema de interesse do lead (leads.product_id). Sem envio nesta etapa. Mesmo padrão do CRM: FK composta,
-- RLS (leitura de membro, escrita só do owner), privilégios por coluna e mfa_required. Sem DELETE: sistemas e
-- modelos são referenciados (leads, campanhas, fila) e "saem de uso" por `active = false`.

-- ------------------------------------------------------------------ products
create table public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  description text check (description is null or char_length(description) <= 1000),
  -- Frase curta usada em {{proposta}} nas mensagens.
  value_proposition text check (value_proposition is null or char_length(value_proposition) <= 500),
  audience text check (audience is null or char_length(audience) <= 300),
  demo_url text check (demo_url is null or (char_length(demo_url) <= 2048 and demo_url ~* '^https?://[^[:space:]]+$')),
  price_note text check (price_note is null or char_length(price_note) <= 200),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

create unique index products_org_name_key on public.products (organization_id, lower(name));

create trigger products_set_updated_at before update on public.products
  for each row execute function private.set_updated_at();

-- ----------------------------------------------------------- message_templates
create table public.message_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  product_id uuid,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  channel text not null check (channel in ('email', 'whatsapp')),
  -- Público do modelo; WhatsApp só para morno e quente (D105), imposto também aqui.
  temperature text check (temperature is null or temperature in ('cold', 'warm', 'hot')),
  -- 1 = primeira mensagem; 2 e 3 = lembretes (D+3 e D+7).
  step smallint not null default 1 check (step between 1 and 3),
  subject text,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  -- Variações escolhidas de forma determinística por lead (ver src/features/outreach/render.ts).
  openings text[] not null default '{}' check (cardinality(openings) <= 10),
  closings text[] not null default '{}' check (cardinality(closings) <= 10),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, product_id) references public.products (organization_id, id),
  -- coalesce: sem público (null) o `in` devolve null e o CHECK deixaria passar.
  check (channel <> 'whatsapp' or coalesce(temperature in ('warm', 'hot'), false)),
  check (
    (channel = 'whatsapp' and subject is null)
    or (channel = 'email' and subject is not null and char_length(btrim(subject)) between 1 and 200)
  )
);

create index message_templates_org_idx on public.message_templates (organization_id, channel, step) where active;
create index message_templates_product_idx on public.message_templates (organization_id, product_id) where product_id is not null;

-- Cada variação tem de ter texto (1 a 300 caracteres). CHECK não aceita subconsulta; o gatilho valida.
create function private.message_templates_validate()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v text;
begin
  foreach v in array new.openings || new.closings
  loop
    if v is null or char_length(btrim(v)) not between 1 and 300 then
      raise exception 'cada abertura/fechamento precisa ter de 1 a 300 caracteres' using errcode = '23514';
    end if;
  end loop;
  return new;
end;
$$;

create trigger message_templates_validate before insert or update of openings, closings on public.message_templates
  for each row execute function private.message_templates_validate();
revoke all on function private.message_templates_validate() from public, anon, authenticated;

create trigger message_templates_set_updated_at before update on public.message_templates
  for each row execute function private.set_updated_at();

-- ----------------------------------------------------------- leads.product_id
alter table public.leads add column product_id uuid;
alter table public.leads add foreign key (organization_id, product_id) references public.products (organization_id, id);
create index leads_org_product_idx on public.leads (organization_id, product_id) where product_id is not null;
grant insert (product_id) on public.leads to authenticated;
grant update (product_id) on public.leads to authenticated;

-- ------------------------------------------------------------------ grants
revoke all on public.products, public.message_templates from public, anon, authenticated;
grant select on public.products, public.message_templates to authenticated;
grant insert (organization_id, name, description, value_proposition, audience, demo_url, price_note, active)
  on public.products to authenticated;
grant update (name, description, value_proposition, audience, demo_url, price_note, active)
  on public.products to authenticated;
grant insert (organization_id, product_id, name, channel, temperature, step, subject, body, openings, closings, active)
  on public.message_templates to authenticated;
grant update (product_id, name, channel, temperature, step, subject, body, openings, closings, active)
  on public.message_templates to authenticated;

-- ------------------------------------------------------------------- RLS
alter table public.products enable row level security;
alter table public.message_templates enable row level security;

create policy products_select_member on public.products
  for select to authenticated using (private.is_active_member(organization_id));
create policy products_insert_owner on public.products
  for insert to authenticated with check (private.is_active_owner(organization_id));
create policy products_update_owner on public.products
  for update to authenticated
  using (private.is_active_owner(organization_id))
  with check (private.is_active_owner(organization_id));

create policy message_templates_select_member on public.message_templates
  for select to authenticated using (private.is_active_member(organization_id));
create policy message_templates_insert_owner on public.message_templates
  for insert to authenticated with check (private.is_active_owner(organization_id));
create policy message_templates_update_owner on public.message_templates
  for update to authenticated
  using (private.is_active_owner(organization_id))
  with check (private.is_active_owner(organization_id));

do $$
declare
  t text;
begin
  foreach t in array array['products', 'message_templates']
  loop
    execute format(
      'create policy mfa_required on public.%I as restrictive for all to authenticated '
      'using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()))', t);
  end loop;
end $$;

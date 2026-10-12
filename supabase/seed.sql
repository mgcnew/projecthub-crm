-- Dados de DESENVOLVIMENTO LOCAL (executado em `supabase db reset`). Nunca usar em ambiente hospedado.
-- Usuário de teste: dev@projecthub.local / DevLocal#2026 — existe só no banco local.
-- O trigger on_auth_user_created provisiona perfil + organização pessoal + owner.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
) values (
  '00000000-0000-0000-0000-000000000000', 'dddddddd-0000-0000-0000-00000000dead',
  'authenticated', 'authenticated', 'dev@projecthub.local',
  extensions.crypt('DevLocal#2026', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{"display_name":"Dev Local"}', now(), now(),
  '', '', '', ''
);

insert into auth.identities (
  id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
) values (
  gen_random_uuid(), 'dddddddd-0000-0000-0000-00000000dead', 'dev@projecthub.local', 'email',
  '{"sub":"dddddddd-0000-0000-0000-00000000dead","email":"dev@projecthub.local","email_verified":true}',
  now(), now(), now()
);

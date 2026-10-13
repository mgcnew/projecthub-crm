-- Autenticação em duas etapas (TOTP) imposta no banco, não só na tela (D082).
-- Regra: se o usuário tem um fator verificado em auth.mfa_factors, a sessão só acessa dados com aal2.
-- Quem não tem fator continua com aal1 (comportamento anterior). Políticas RESTRICTIVE somam-se às existentes:
-- nenhuma política permissiva é relaxada. Reversível: basta remover as políticas `mfa_required` e a função.

create function private.mfa_satisfied()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (
      select 1
        from auth.mfa_factors f
       where f.user_id = (select auth.uid())
         and f.status = 'verified'
    )
    then coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2'
    else true
  end;
$$;

revoke all on function private.mfa_satisfied() from public, anon;
grant execute on function private.mfa_satisfied() to authenticated;

-- Uma política restritiva por tabela de public (inclui tabelas futuras só se esta migração for repetida;
-- o teste 007 falha se alguma tabela de public ficar sem `mfa_required`).
do $$
declare
  t text;
begin
  for t in
    select c.relname
      from pg_class c
     where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
  loop
    execute format(
      'create policy mfa_required on public.%I as restrictive for all to authenticated '
      'using ((select private.mfa_satisfied())) with check ((select private.mfa_satisfied()))', t);
  end loop;
end $$;

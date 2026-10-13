#!/usr/bin/env bash
# Ensaio de restauração: restaura um backup (scripts/db-backup.sh) num banco DESCARTÁVEL do mesmo
# servidor e verifica integridade, contagens, RLS e acesso funcional como usuário autenticado.
# Não toca no banco `postgres` (somente leitura) e remove o banco de teste ao final.
# Uso: scripts/db-restore-check.sh [diretório-do-backup]   (padrão: o mais recente em backups/)
set -euo pipefail
cd "$(dirname "$0")/.."

CONTAINER="${DB_CONTAINER:-supabase_db_projecthub-crm}"
BACKUP="${1:-$(ls -1d "${BACKUP_DIR:-backups}"/*/ 2>/dev/null | sort | tail -n1)}"
BACKUP="${BACKUP%/}"
[ -n "$BACKUP" ] && [ -f "$BACKUP/data.dump" ] || { echo "Backup não encontrado. Rode scripts/db-backup.sh." >&2; exit 2; }

SCRATCH="restore_check_$$"
export PGPASSWORD_VALUE="${PGPASSWORD:-postgres}"
pg() { docker exec -i -e PGPASSWORD="$PGPASSWORD_VALUE" "$CONTAINER" "$@"; }
psql_src() { pg psql -h localhost -U supabase_admin -d postgres -v ON_ERROR_STOP=1 "$@"; }
psql_dst() { pg psql -h localhost -U supabase_admin -d "$SCRATCH" -v ON_ERROR_STOP=1 "$@"; }
fail() { echo "FALHOU: $*" >&2; exit 1; }
cleanup() { psql_src -qc "drop database if exists \"$SCRATCH\" with (force)" >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "1/7 Integridade dos arquivos"
(cd "$BACKUP" && sha256sum --check --quiet SHA256SUMS) || fail "checksum divergente"

echo "2/7 Banco descartável $SCRATCH (a partir de template0)"
psql_src -qc "create database \"$SCRATCH\" template template0"
psql_dst -qc "drop schema public cascade"   # o dump traz o próprio CREATE SCHEMA public

echo "3/7 Esquema: stub mínimo de auth + esquema public/private do backup"
# auth.users/identities pertencem ao GoTrue (fora das migrações); o esquema delas vem do banco de origem.
{
  echo "create schema auth;"
  echo "create function auth.uid() returns uuid language sql stable as \$f\$
    select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
                    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid \$f\$;"
  # D082: `private.mfa_satisfied` (política mfa_required) lê auth.mfa_factors e o claim aal do JWT.
  echo "create table auth.mfa_factors (id uuid primary key, user_id uuid not null, status text not null);"
  echo "create function auth.jwt() returns jsonb language sql stable as \$f\$
    select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb \$f\$;"
  # Sem os triggers de auth.users (ex.: on_auth_user_created chama private.*, que ainda não existe aqui).
  pg pg_dump -h localhost -U supabase_admin -d postgres --schema-only --no-owner -t auth.users -t auth.identities \
    | sed '/^CREATE TRIGGER /d'
} | psql_dst -q >/dev/null
psql_dst -q -f - < "$BACKUP/schema.sql" >/dev/null

echo "4/7 Dados (pg_restore com gatilhos desligados: não regrava auditoria nem dispara workers)"
pg pg_restore -h localhost -U supabase_admin -d "$SCRATCH" --data-only --disable-triggers --no-owner --exit-on-error < "$BACKUP/data.dump"

echo "5/7 Contagens por tabela contra o manifesto do backup"
psql_dst -At -F $'\t' -c "
  select table_schema || '.' || table_name,
         (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text
    from information_schema.tables
   where table_type = 'BASE TABLE'
     and (table_schema = 'public' or (table_schema = 'auth' and table_name in ('users', 'identities')))
   order by 1" > "$BACKUP/.restored_counts.tsv"
diff -u "$BACKUP/counts.tsv" "$BACKUP/.restored_counts.tsv" >/dev/null || { diff -u "$BACKUP/counts.tsv" "$BACKUP/.restored_counts.tsv" >&2 || true; fail "contagens divergem do manifesto"; }
rm -f "$BACKUP/.restored_counts.tsv"

echo "6/7 Integridade referencial e RLS no banco restaurado"
psql_dst -q <<'SQL' >/dev/null
do $$
declare r record; n bigint; bad text := '';
begin
  for r in
    select con.conname, con.conrelid::regclass as child, con.confrelid::regclass as parent,
           (select string_agg(format('c.%I = p.%I', ca.attname, pa.attname), ' and ' order by k.ord)
              from unnest(con.conkey, con.confkey) with ordinality k(c, p, ord)
              join pg_attribute ca on ca.attrelid = con.conrelid and ca.attnum = k.c
              join pg_attribute pa on pa.attrelid = con.confrelid and pa.attnum = k.p) as joincond,
           (select string_agg(format('c.%I is not null', ca.attname), ' and ')
              from unnest(con.conkey) a(c) join pg_attribute ca on ca.attrelid = con.conrelid and ca.attnum = a.c) as notnull
      from pg_constraint con
     where con.contype = 'f' and con.connamespace = 'public'::regnamespace
  loop
    execute format('select count(*) from %s c where %s and not exists (select 1 from %s p where %s)',
                   r.child, r.notnull, r.parent, r.joincond) into n;
    if n > 0 then bad := bad || format('%s(%s) ', r.conname, n); end if;
  end loop;
  if bad <> '' then raise exception 'FKs com órfãos: %', bad; end if;

  if exists (select 1 from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and not c.relrowsecurity) then
    raise exception 'tabela sem RLS após a restauração';
  end if;
end $$;
SQL
SRC_POL=$(psql_src -Atc "select count(*) from pg_policies where schemaname = 'public'")
DST_POL=$(psql_dst -Atc "select count(*) from pg_policies where schemaname = 'public'")
[ "$SRC_POL" = "$DST_POL" ] || fail "políticas: origem=$SRC_POL restaurado=$DST_POL"

echo "7/7 Acesso funcional como usuário autenticado (RLS sobre os dados restaurados)"
USER_ID=$(psql_dst -Atc "select o.created_by from public.tasks t join public.organizations o on o.id = t.organization_id group by o.created_by order by count(*) desc limit 1")
if [ -n "$USER_ID" ]; then
  VISIBLE_SQL="begin; select set_config('request.jwt.claims', json_build_object('sub','$USER_ID','role','authenticated')::text, true); set local role authenticated; select count(*) from public.tasks; rollback;"
  # origem e restaurado devem enxergar exatamente o mesmo número de tarefas para esse usuário
  SRC_N=$(psql_src -At -c "$VISIBLE_SQL" | grep -E '^[0-9]+$' | tail -n1)
  DST_N=$(psql_dst -At -c "$VISIBLE_SQL" | grep -E '^[0-9]+$' | tail -n1)
  [ "$SRC_N" = "$DST_N" ] || fail "tarefas visíveis ao usuário $USER_ID: origem=$SRC_N restaurado=$DST_N"
  echo "    usuário de teste vê $DST_N tarefas (igual à origem)"
else
  echo "    sem tarefas no banco; verificação funcional ignorada"
fi

echo "RESTAURAÇÃO VERIFICADA: $(wc -l < "$BACKUP/counts.tsv") tabelas, $(awk -F'\t' '{s+=$2} END {print s}' "$BACKUP/counts.tsv") linhas, $DST_POL políticas, FKs sem órfãos."

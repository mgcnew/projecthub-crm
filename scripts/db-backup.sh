#!/usr/bin/env bash
# Backup lógico do banco local do ProjectHub CRM.
#   data.dump   dados de public.* + auth.users/auth.identities (pg_dump custom, comprimido)
#   schema.sql  esquema de public/private com privilégios (referência; a fonte de verdade são as migrações)
#   counts.tsv  linhas por tabela no momento do dump (conferido pelo db-restore-check.sh)
#   SHA256SUMS  integridade dos arquivos
# Nada de segredo entra no backup, mas os DADOS são pessoais: guarde criptografado e fora do Git.
# Para o projeto hospedado use `supabase db dump --linked` (docs/RUNBOOK.md).
set -euo pipefail
cd "$(dirname "$0")/.."

CONTAINER="${DB_CONTAINER:-supabase_db_projecthub-crm}"
export PGPASSWORD_VALUE="${PGPASSWORD:-postgres}"
OUT="${1:-${BACKUP_DIR:-backups}/$(date -u +%Y%m%dT%H%M%SZ)}"

pg() { docker exec -i -e PGPASSWORD="$PGPASSWORD_VALUE" "$CONTAINER" "$@"; }
PGARGS=(-h localhost -U supabase_admin -d postgres)

mkdir -p "$OUT"
umask 077

pg pg_dump "${PGARGS[@]}" -Fc --data-only --no-owner -t 'public.*' -t auth.users -t auth.identities > "$OUT/data.dump"
pg pg_dump "${PGARGS[@]}" --schema-only --no-owner -n public -n private > "$OUT/schema.sql"

pg psql "${PGARGS[@]}" -At -F $'\t' -c "
  select table_schema || '.' || table_name,
         (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text
    from information_schema.tables
   where table_type = 'BASE TABLE'
     and (table_schema = 'public' or (table_schema = 'auth' and table_name in ('users', 'identities')))
   order by 1" > "$OUT/counts.tsv"

(cd "$OUT" && sha256sum data.dump schema.sql counts.tsv > SHA256SUMS)

echo "Backup criado em $OUT"
echo "  tabelas: $(wc -l < "$OUT/counts.tsv")  linhas: $(awk -F'\t' '{s+=$2} END {print s}' "$OUT/counts.tsv")  tamanho: $(du -sh "$OUT" | cut -f1)"

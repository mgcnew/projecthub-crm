#!/usr/bin/env bash
# Lê URL e chave publicável do Supabase local e roda os testes E2E (Playwright).
set -euo pipefail
cd "$(dirname "$0")/.."
eval "$(npx supabase status -o env 2>/dev/null | grep -E '^(API_URL|PUBLISHABLE_KEY|ANON_KEY)=')"
export SUPABASE_URL="$API_URL"
export SUPABASE_PUBLISHABLE_KEY="${PUBLISHABLE_KEY:-$ANON_KEY}"
# O servidor Vite iniciado pelo Playwright usa o mesmo projeto Supabase dos testes.
export VITE_SUPABASE_URL="$SUPABASE_URL"
export VITE_SUPABASE_PUBLISHABLE_KEY="$SUPABASE_PUBLISHABLE_KEY"
exec npx playwright test "$@"

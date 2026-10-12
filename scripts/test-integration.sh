#!/usr/bin/env bash
# Lê URL e chave publicável do Supabase local e roda os testes de integração.
set -euo pipefail
cd "$(dirname "$0")/.."
eval "$(npx supabase status -o env 2>/dev/null | grep -E '^(API_URL|PUBLISHABLE_KEY|ANON_KEY)=')"
export SUPABASE_URL="$API_URL"
export SUPABASE_PUBLISHABLE_KEY="${PUBLISHABLE_KEY:-$ANON_KEY}"
exec npx vitest run --config vitest.integration.config.ts "$@"

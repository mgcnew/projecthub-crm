import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { parseEnv } from './env'

const parsed = parseEnv(import.meta.env)
if (!parsed.success) {
  throw new Error(
    'Variáveis VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY ausentes ou inválidas. Veja .env.example.',
  )
}

// Somente a chave publicável: o acesso aos dados é decidido por RLS, nunca por segredo no cliente.
export const supabase = createClient<Database>(
  parsed.data.VITE_SUPABASE_URL,
  parsed.data.VITE_SUPABASE_PUBLISHABLE_KEY,
)

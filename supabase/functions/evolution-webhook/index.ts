// Webhook do Evolution (respostas recebidas e estado da conexão). Segredo: EVOLUTION_WEBHOOK_SECRET, enviado pelo
// Evolution no cabeçalho x-webhook-secret (ou na URL, ?secret=).
import { createClient } from 'npm:@supabase/supabase-js@2'
import { webhookDb, type ServiceClient } from '../_shared/db.ts'
import { handleEvolutionWebhook } from '../_shared/handlers.ts'

const env = (k: string) => Deno.env.get(k) ?? ''
const client = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } }) as unknown as ServiceClient

Deno.serve((req) => handleEvolutionWebhook(req, { db: webhookDb(client), secret: env('EVOLUTION_WEBHOOK_SECRET') }))

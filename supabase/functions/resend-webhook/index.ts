// Webhook do Resend (bounce e reclamação → supressão). Segredo: RESEND_WEBHOOK_SECRET ("whsec_..."), do painel do Resend.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { webhookDb, type ServiceClient } from '../_shared/db.ts'
import { handleResendWebhook } from '../_shared/handlers.ts'

const env = (k: string) => Deno.env.get(k) ?? ''
const client = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } }) as unknown as ServiceClient

Deno.serve((req) => handleResendWebhook(req, { db: webhookDb(client), secret: env('RESEND_WEBHOOK_SECRET') }))

// Link de descadastro do e-mail (e botão "cancelar inscrição"). Autentica pelo token assinado (UNSUBSCRIBE_SECRET).
import { createClient } from 'npm:@supabase/supabase-js@2'
import { unsubscribeDb, type ServiceClient } from '../_shared/db.ts'
import { handleUnsubscribe } from '../_shared/handlers.ts'

const env = (k: string) => Deno.env.get(k) ?? ''
const client = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } }) as unknown as ServiceClient

Deno.serve((req) => handleUnsubscribe(req, { db: unsubscribeDb(client), secret: env('UNSUBSCRIBE_SECRET') }))

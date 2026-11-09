// Envia o lote de mensagens aprovadas. Chamada pelo pg_cron/pg_net a cada minuto com o cabeçalho x-cron-secret.
// Segredos (supabase secrets set ...): CRON_SECRET, UNSUBSCRIBE_SECRET, EMAIL_PROVIDER (resend|fake),
// RESEND_API_KEY, WHATSAPP_PROVIDER (evolution|fake), EVOLUTION_URL, EVOLUTION_INSTANCE, EVOLUTION_API_KEY.
// Sem EMAIL_PROVIDER/WHATSAPP_PROVIDER explícitos o provedor é `fake`: nada sai de verdade por engano.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { outboxDb, type ServiceClient } from '../_shared/db.ts'
import { handleSendOutbox } from '../_shared/handlers.ts'
import { evolutionProvider, fakeEmailProvider, fakeWhatsAppProvider, resendProvider } from '../_shared/providers.ts'

const env = (k: string) => Deno.env.get(k) ?? ''
const url = env('SUPABASE_URL')
const client = createClient(url, env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } }) as unknown as ServiceClient

const email = env('EMAIL_PROVIDER') === 'resend' && env('RESEND_API_KEY') ? resendProvider(env('RESEND_API_KEY')) : fakeEmailProvider()
const whatsapp =
  env('WHATSAPP_PROVIDER') === 'evolution' && env('EVOLUTION_URL') && env('EVOLUTION_API_KEY')
    ? evolutionProvider({ baseUrl: env('EVOLUTION_URL'), instance: env('EVOLUTION_INSTANCE'), apiKey: env('EVOLUTION_API_KEY') })
    : fakeWhatsAppProvider()

Deno.serve((req) =>
  handleSendOutbox(req, {
    db: outboxDb(client),
    email,
    whatsapp,
    cronSecret: env('CRON_SECRET'),
    unsubscribeSecret: env('UNSUBSCRIBE_SECRET'),
    unsubscribeBaseUrl: `${url}/functions/v1/unsubscribe`,
  }),
)

// Rascunho com IA (DESLIGADO por padrão). Exige o JWT do usuário (verify_jwt), `draft_provider = 'deepseek'` na configuração
// e o segredo DEEPSEEK_API_KEY (supabase secrets set DEEPSEEK_API_KEY=...). Sem a chave o provedor é `none`.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { draftDb, type ServiceClient, type UserClient } from '../_shared/db.ts'
import { deepseekProvider, handleDraftMessage, noneProvider } from '../_shared/draft.ts'

const env = (k: string) => Deno.env.get(k) ?? ''
const service = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } }) as unknown as ServiceClient
const provider = env('DEEPSEEK_API_KEY') ? deepseekProvider(env('DEEPSEEK_API_KEY')) : noneProvider

Deno.serve((req) => {
  const user = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false },
  }) as unknown as UserClient
  return handleDraftMessage(req, { db: draftDb(user, service), provider })
})

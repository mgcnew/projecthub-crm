import { z } from 'zod'
import { emptyToNull } from '@/lib/format'

/** Sugestões de categoria (texto livre; o banco aceita qualquer valor de até 60 caracteres). */
export const accessCategories = [
  'E-mail',
  'Hospedagem',
  'Repositório',
  'Banco de dados',
  'Domínio',
  'Pagamentos',
  'Ferramenta',
  'Outro',
] as const

export type ServiceSuggestion = { name: string; category: string; url: string }

/** Serviços comuns para escolher com um clique (nome, categoria e endereço do painel); o usuário ainda pode digitar outro. */
export const builtinServices: readonly ServiceSuggestion[] = [
  { name: 'Supabase', category: 'Banco de dados', url: 'https://supabase.com/dashboard' },
  { name: 'GitHub', category: 'Repositório', url: 'https://github.com' },
  { name: 'Vercel', category: 'Hospedagem', url: 'https://vercel.com/dashboard' },
  { name: 'Cloudflare', category: 'Domínio', url: 'https://dash.cloudflare.com' },
  { name: 'Registro.br', category: 'Domínio', url: 'https://registro.br' },
  { name: 'Hostinger', category: 'Hospedagem', url: 'https://hpanel.hostinger.com' },
  { name: 'AWS', category: 'Hospedagem', url: 'https://console.aws.amazon.com' },
  { name: 'Google (Gmail)', category: 'E-mail', url: 'https://mail.google.com' },
  { name: 'Resend', category: 'E-mail', url: 'https://resend.com' },
  { name: 'Stripe', category: 'Pagamentos', url: 'https://dashboard.stripe.com' },
  { name: 'Mercado Pago', category: 'Pagamentos', url: 'https://www.mercadopago.com.br' },
  { name: 'Figma', category: 'Ferramenta', url: 'https://www.figma.com' },
]

/**
 * Sugestões do formulário: primeiro os serviços que o usuário já cadastrou (com a categoria e o endereço do registro mais
 * recente, sem repetir o nome), depois os comuns que ainda não foram usados. Assim cada serviço novo vira atalho para os outros projetos.
 */
export function mergeServiceSuggestions(used: readonly ServiceSuggestion[]): ServiceSuggestion[] {
  const seen = new Set<string>()
  const out: ServiceSuggestion[] = []
  for (const s of [...used, ...builtinServices]) {
    const name = s.name.trim()
    const key = name.toLocaleLowerCase('pt-BR')
    if (!name || seen.has(key)) continue
    seen.add(key)
    out.push({ name, category: s.category?.trim() ?? '', url: s.url?.trim() ?? '' })
  }
  return out
}

/** Só http(s): a URL vira link; `javascript:` e afins nunca são aceitos (o banco também confere). */
export const isHttpUrl = (v: string) => /^https?:\/\/[^\s]+$/i.test(v)

export const accessFormSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome do serviço').max(200, 'Máximo de 200 caracteres'),
  category: z.string().trim().max(60, 'Máximo de 60 caracteres'),
  url: z
    .string()
    .trim()
    .max(2048, 'Máximo de 2.048 caracteres')
    .refine((v) => v === '' || isHttpUrl(v), 'Use um endereço que comece com http:// ou https://'),
  username: z.string().trim().max(320, 'Máximo de 320 caracteres'),
  manager_item: z.string().trim().max(200, 'Máximo de 200 caracteres'),
  project_id: z.string(),
  client_id: z.string(),
  notes: z.string().max(5000, 'Máximo de 5.000 caracteres'),
})

export type AccessFormValues = z.infer<typeof accessFormSchema>

export const accessDefaults: AccessFormValues = {
  name: '',
  category: '',
  url: '',
  username: '',
  manager_item: '',
  project_id: '',
  client_id: '',
  notes: '',
}

export function accessPayload(v: AccessFormValues) {
  return {
    name: v.name.trim(),
    category: emptyToNull(v.category),
    url: emptyToNull(v.url),
    username: emptyToNull(v.username),
    manager_item: emptyToNull(v.manager_item),
    project_id: emptyToNull(v.project_id),
    client_id: emptyToNull(v.client_id),
    notes: emptyToNull(v.notes),
  }
}

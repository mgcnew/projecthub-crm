import { z } from 'zod'
import { emptyToNull } from '@/lib/format'

export const channels = { email: 'E-mail', whatsapp: 'WhatsApp' } as const
export const stepLabels = { 1: '1ª mensagem', 2: 'Lembrete 1 (D+3)', 3: 'Lembrete 2 (D+7)' } as const
export type Channel = keyof typeof channels

/** Uma variação por linha; linhas em branco somem. */
export const splitLines = (v: string) =>
  v
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

const variations = z
  .string()
  .refine((v) => splitLines(v).length <= 10, 'No máximo 10 variações')
  .refine((v) => splitLines(v).every((l) => l.length <= 300), 'Cada variação pode ter até 300 caracteres')

// ----------------------------------------------------------------- sistemas
export const productFormSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome do sistema').max(120, 'Máximo de 120 caracteres'),
  description: z.string().trim().max(1000, 'Máximo de 1.000 caracteres'),
  value_proposition: z.string().trim().max(500, 'Máximo de 500 caracteres'),
  audience: z.string().trim().max(300, 'Máximo de 300 caracteres'),
  demo_url: z
    .string()
    .trim()
    .max(2048, 'Máximo de 2.048 caracteres')
    .refine((v) => v === '' || /^https?:\/\/[^\s]+$/i.test(v), 'Use um endereço que comece com http:// ou https://'),
  price_note: z.string().trim().max(200, 'Máximo de 200 caracteres'),
  active: z.boolean(),
})
export type ProductFormValues = z.infer<typeof productFormSchema>

export const productDefaults: ProductFormValues = {
  name: '',
  description: '',
  value_proposition: '',
  audience: '',
  demo_url: '',
  price_note: '',
  active: true,
}

export function productPayload(v: ProductFormValues) {
  return {
    name: v.name.trim(),
    description: emptyToNull(v.description),
    value_proposition: emptyToNull(v.value_proposition),
    audience: emptyToNull(v.audience),
    demo_url: emptyToNull(v.demo_url),
    price_note: emptyToNull(v.price_note),
    active: v.active,
  }
}

// ------------------------------------------------------------------- modelos
export const templateFormSchema = z
  .object({
    name: z.string().trim().min(1, 'Informe o nome do modelo').max(120, 'Máximo de 120 caracteres'),
    product_id: z.string(),
    channel: z.enum(['email', 'whatsapp']),
    temperature: z.enum(['', 'cold', 'warm', 'hot']),
    step: z.enum(['1', '2', '3']),
    subject: z.string().trim().max(200, 'Máximo de 200 caracteres'),
    body: z.string().trim().min(1, 'Escreva a mensagem').max(4000, 'Máximo de 4.000 caracteres'),
    openings: variations,
    closings: variations,
    active: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.channel === 'whatsapp' && v.temperature !== 'warm' && v.temperature !== 'hot') {
      ctx.addIssue({ code: 'custom', path: ['temperature'], message: 'WhatsApp é só para lead morno ou quente' })
    }
    if (v.channel === 'email' && v.subject === '') {
      ctx.addIssue({ code: 'custom', path: ['subject'], message: 'Informe o assunto do e-mail' })
    }
  })
export type TemplateFormValues = z.infer<typeof templateFormSchema>

export const templateDefaults: TemplateFormValues = {
  name: '',
  product_id: '',
  channel: 'email',
  temperature: '',
  step: '1',
  subject: '',
  body: '',
  openings: '',
  closings: '',
  active: true,
}

export function templatePayload(v: TemplateFormValues) {
  return {
    name: v.name.trim(),
    product_id: emptyToNull(v.product_id),
    channel: v.channel,
    temperature: v.temperature === '' ? null : v.temperature,
    step: Number(v.step),
    subject: v.channel === 'email' ? v.subject.trim() : null,
    body: v.body.trim(),
    openings: splitLines(v.openings),
    closings: splitLines(v.closings),
    active: v.active,
  }
}

/** Mensagem de erro do servidor em português (códigos do Postgres). */
export function outreachErrorMessage(e: unknown): string {
  const code = (e as { code?: string } | null)?.code
  if (code === '23505') return 'Já existe um sistema com esse nome.'
  if (code === '23514') return 'Algum campo não atende às regras (WhatsApp só para morno/quente, e-mail precisa de assunto, até 10 variações de até 300 caracteres).'
  if (code === '42501') return 'Você não tem permissão para esta ação.'
  return 'Não foi possível salvar. Tente de novo.'
}

// ----------------------------------------------------------------- campanhas
const dayField = z
  .string()
  .trim()
  .refine((v) => v === '' || (/^\d{1,2}$/.test(v) && Number(v) >= 1 && Number(v) <= 60), 'Use um número de dias de 1 a 60')

export const campaignFormSchema = z
  .object({
    name: z.string().trim().min(1, 'Informe o nome da campanha').max(120, 'Máximo de 120 caracteres'),
    product_id: z.string(),
    channel: z.enum(['email', 'whatsapp']),
    temperature: z.enum(['', 'cold', 'warm', 'hot']),
    daily_limit: z.string().regex(/^\d{1,3}$/, 'Informe um número de 1 a 100').refine((v) => Number(v) >= 1 && Number(v) <= 100, 'Informe um número de 1 a 100'),
    followup_1: dayField,
    followup_2: dayField,
    step1_template_id: z.string(),
    step2_template_id: z.string(),
    step3_template_id: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.channel === 'whatsapp' && v.temperature !== 'warm' && v.temperature !== 'hot') {
      ctx.addIssue({ code: 'custom', path: ['temperature'], message: 'WhatsApp é só para lead morno ou quente' })
    }
    if (v.followup_1 === '' && v.followup_2 !== '') {
      ctx.addIssue({ code: 'custom', path: ['followup_1'], message: 'Preencha o 1º lembrete antes do 2º' })
    }
    if (v.followup_1 !== '' && v.followup_2 !== '' && Number(v.followup_2) <= Number(v.followup_1)) {
      ctx.addIssue({ code: 'custom', path: ['followup_2'], message: 'O 2º lembrete vem depois do 1º' })
    }
    if (v.followup_1 === '' && v.step2_template_id !== '') {
      ctx.addIssue({ code: 'custom', path: ['step2_template_id'], message: 'Sem 1º lembrete não há modelo do passo 2' })
    }
    if (v.followup_2 === '' && v.step3_template_id !== '') {
      ctx.addIssue({ code: 'custom', path: ['step3_template_id'], message: 'Sem 2º lembrete não há modelo do passo 3' })
    }
  })
export type CampaignFormValues = z.infer<typeof campaignFormSchema>

export const campaignDefaults: CampaignFormValues = {
  name: '',
  product_id: '',
  channel: 'email',
  temperature: '',
  daily_limit: '20',
  followup_1: '3',
  followup_2: '7',
  step1_template_id: '',
  step2_template_id: '',
  step3_template_id: '',
}

export function campaignPayload(v: CampaignFormValues) {
  const days = [v.followup_1, v.followup_2].filter((d) => d !== '').map(Number)
  return {
    name: v.name.trim(),
    product_id: emptyToNull(v.product_id),
    daily_limit: Number(v.daily_limit),
    followup_days: days,
    step1_template_id: emptyToNull(v.step1_template_id),
    step2_template_id: days.length >= 1 ? emptyToNull(v.step2_template_id) : null,
    step3_template_id: days.length >= 2 ? emptyToNull(v.step3_template_id) : null,
  }
}

export const campaignStatusLabels = { draft: 'Rascunho', active: 'Ativa', paused: 'Pausada', finished: 'Encerrada' } as const
export const campaignLeadStatusLabels = { active: 'Na sequência', replied: 'Respondeu', finished: 'Encerrado', opted_out: 'Saiu', failed: 'Falhou' } as const

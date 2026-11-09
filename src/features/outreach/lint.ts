/**
 * Verificador de estilo (D126): avisos, nunca bloqueio. Ajuda a manter a mensagem curta, humana e sem cara de
 * robô. Roda ao salvar o modelo (`lintTemplate`) e ao revisar o texto final de um lead (`lintMessage`).
 */
import { PLACEHOLDERS, placeholdersIn, type Placeholder } from './render'

export type LintCode = 'length' | 'link' | 'questions' | 'cliche' | 'emoji' | 'exclamation' | 'missing' | 'unknown' | 'demo-step1'
export type LintWarning = { code: LintCode; message: string }

export const CLICHES = [
  'espero que esteja bem',
  'venho por meio desta',
  'solução inovadora',
  'alavancar',
  'sinergia',
  'transformação digital',
  'melhor do mercado',
  'oportunidade única',
  'não perca',
  'prezado',
  'revolucionar',
] as const

const LIMITS = { email: { first: 600, later: 400 }, whatsapp: { first: 300, later: 200 } } as const

const count = (text: string, re: RegExp) => (text.match(re) ?? []).length

export function lintMessage(input: {
  channel: 'email' | 'whatsapp'
  step: number
  text: string
  subject?: string | null
  missing?: Placeholder[]
  unknown?: string[]
}): LintWarning[] {
  const { channel, step, text } = input
  const all = `${input.subject ?? ''}\n${text}`
  const out: LintWarning[] = []

  const limit = step === 1 ? LIMITS[channel].first : LIMITS[channel].later
  if (text.length > limit) {
    out.push({ code: 'length', message: `Texto com ${text.length} caracteres (o ideal é até ${limit} ${step === 1 ? 'na primeira mensagem' : 'nos lembretes'}).` })
  }
  if (step === 1 && /https?:\/\/|www\./i.test(all)) {
    out.push({ code: 'link', message: 'Link na primeira mensagem aumenta a chance de cair em spam. Deixe o link para o passo 2.' })
  }
  if (count(text, /\?/g) > 1) out.push({ code: 'questions', message: 'Mais de uma pergunta. Faça uma só, bem direta.' })
  const lower = all.toLocaleLowerCase('pt-BR')
  const found = CLICHES.filter((c) => lower.includes(c))
  if (found.length > 0) out.push({ code: 'cliche', message: `Frase de modelo pronto: ${found.map((f) => `“${f}”`).join(', ')}. Soa como robô.` })
  if (count(all, /\p{Extended_Pictographic}/gu) > 2) out.push({ code: 'emoji', message: 'Emojis demais (use no máximo 2).' })
  if (count(all, /!/g) > 2) out.push({ code: 'exclamation', message: 'Muitas exclamações (use no máximo 2).' })
  for (const m of input.missing ?? []) {
    out.push({ code: 'missing', message: `Este lead está sem ${m === 'demo' ? 'link de demonstração' : m === 'proposta' ? 'proposta de valor no sistema' : m === 'sistema' ? 'sistema' : m}; o trecho ficou vazio.` })
  }
  for (const u of input.unknown ?? []) out.push({ code: 'unknown', message: `{{${u}}} não existe. Use: ${PLACEHOLDERS.map((p) => `{{${p}}}`).join(', ')}.` })
  return out
}

/** Verifica o modelo no pior caso (corpo + maior abertura + maior fechamento) e os placeholders digitados. */
export function lintTemplate(t: {
  channel: 'email' | 'whatsapp'
  step: number
  subject: string | null
  body: string
  openings: string[]
  closings: string[]
}): LintWarning[] {
  const longest = (xs: string[]) => xs.reduce((a, b) => (b.length > a.length ? b : a), '')
  const worst = [longest(t.openings), t.body, longest(t.closings)].filter(Boolean).join('\n\n')
  const base = lintMessage({ channel: t.channel, step: t.step, text: worst, subject: t.subject })
  const everything = [t.subject ?? '', t.body, ...t.openings, ...t.closings].join('\n')
  const tokens = placeholdersIn(everything)
  const valid = new Set<string>([...PLACEHOLDERS, 'abertura', 'fechamento'])
  const unknown = tokens.filter((x) => !valid.has(x))
  const extra: LintWarning[] = unknown.map((u) => ({
    code: 'unknown',
    message: `{{${u}}} não existe. Use: ${PLACEHOLDERS.map((p) => `{{${p}}}`).join(', ')}.`,
  }))
  if (t.step === 1 && tokens.includes('demo')) {
    extra.push({ code: 'demo-step1', message: '{{demo}} no passo 1 é ignorado: o link só vai a partir do passo 2.' })
  }
  return [...base, ...extra]
}

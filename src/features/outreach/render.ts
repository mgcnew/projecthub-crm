/**
 * Renderizador de mensagens (D126): placeholders + variações de abertura e fechamento escolhidas de forma
 * DETERMINÍSTICA por lead (o mesmo lead sempre recebe o mesmo texto; leads diferentes recebem textos diferentes).
 * Função pura: sem acesso ao banco nem ao relógio.
 */
export const PLACEHOLDERS = ['empresa', 'contato', 'gancho', 'sistema', 'proposta', 'demo'] as const
export type Placeholder = (typeof PLACEHOLDERS)[number]
const SPECIAL = ['abertura', 'fechamento'] as const

export type RenderLead = { id: string; company_name: string; contact_name: string | null; hook: string | null }
export type RenderProduct = { name: string; value_proposition: string | null; demo_url: string | null } | null
export type RenderTemplate = {
  id: string
  step: number
  subject: string | null
  body: string
  openings: string[]
  closings: string[]
}

export type Rendered = {
  subject: string | null
  body: string
  opening: string | null
  closing: string | null
  /** Placeholders que ficaram sem valor para este lead (o texto sai sem eles; a revisão deve avisar). */
  missing: Placeholder[]
  /** `{{algo}}` que não existe (provável erro de digitação no modelo). */
  unknown: string[]
  /** `{{demo}}` no passo 1: o link só vale a partir do passo 2, então foi omitido. */
  demoBlocked: boolean
}

/** FNV-1a de 32 bits: pequeno, rápido e estável entre execuções e navegadores. */
export function hash32(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Escolhe uma variação pelo par lead × modelo; `salt` separa a escolha da abertura da do fechamento. */
export function pickVariation(options: string[], leadId: string, templateId: string, salt: string): string | null {
  const list = options.map((o) => o.trim()).filter(Boolean)
  if (list.length === 0) return null
  return list[hash32(`${leadId}:${templateId}:${salt}`) % list.length]
}

const firstName = (full: string | null) => (full ?? '').trim().split(/\s+/)[0] ?? ''

function substitute(text: string, values: Record<Placeholder, string>, used: Set<string>, unknown: Set<string>) {
  return text.replace(/\{\{\s*([a-zA-Zçã]+)\s*\}\}(,?)/g, (whole, name: string, comma: string) => {
    const key = name.toLowerCase()
    if ((PLACEHOLDERS as readonly string[]).includes(key)) {
      used.add(key)
      const value = values[key as Placeholder]
      // Sem nome do contato, "Olá {{contato}}," vira "Olá tudo bem?" (sem vírgula sobrando).
      if (key === 'contato' && value === 'tudo bem?') return value
      return value + comma
    }
    if ((SPECIAL as readonly string[]).includes(key)) return whole
    unknown.add(name)
    return whole
  })
}

/** Limpa o que a substituição pode deixar para trás: espaços duplos, espaço antes de pontuação, linhas vazias. */
export function tidy(text: string): string {
  return text
    .split('\n')
    .map((l) => l.replace(/[ \t]{2,}/g, ' ').replace(/ +([,.;:!?])/g, '$1').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function renderMessage(input: { template: RenderTemplate; lead: RenderLead; product: RenderProduct }): Rendered {
  const { template, lead, product } = input
  const demoBlocked = template.step < 2
  const values: Record<Placeholder, string> = {
    empresa: lead.company_name.trim(),
    contato: firstName(lead.contact_name) || 'tudo bem?',
    gancho: (lead.hook ?? '').trim(),
    sistema: product?.name.trim() ?? '',
    proposta: (product?.value_proposition ?? '').trim(),
    demo: demoBlocked ? '' : (product?.demo_url ?? '').trim(),
  }

  const used = new Set<string>()
  const unknown = new Set<string>()
  const opening = pickVariation(template.openings, lead.id, template.id, 'abertura')
  const closing = pickVariation(template.closings, lead.id, template.id, 'fechamento')

  const hasOpeningToken = /\{\{\s*abertura\s*\}\}/i.test(template.body)
  const hasClosingToken = /\{\{\s*fechamento\s*\}\}/i.test(template.body)
  let body = template.body
    .replace(/\{\{\s*abertura\s*\}\}/gi, opening ?? '')
    .replace(/\{\{\s*fechamento\s*\}\}/gi, closing ?? '')
  if (!hasOpeningToken && opening) body = `${opening}\n\n${body}`
  if (!hasClosingToken && closing) body = `${body}\n\n${closing}`

  const subject = template.subject === null ? null : tidy(substitute(template.subject, values, used, unknown))
  const finalBody = tidy(substitute(body, values, used, unknown))

  const missing = [...used].filter((k): k is Placeholder => {
    const key = k as Placeholder
    if (key === 'demo') return !demoBlocked && values.demo === ''
    if (key === 'contato' || key === 'empresa') return false
    return values[key] === ''
  })
  return {
    subject,
    body: finalBody,
    opening,
    closing,
    missing,
    unknown: [...unknown],
    demoBlocked: demoBlocked && used.has('demo'),
  }
}

/** Todos os `{{...}}` de um texto (sem repetição), para validar o modelo. */
export function placeholdersIn(text: string): string[] {
  return [...new Set([...text.matchAll(/\{\{\s*([a-zA-Zçã]+)\s*\}\}/g)].map((m) => m[1].toLowerCase()))]
}

import { normalizePhone } from '@/lib/phone'

/** Campos do lead que a planilha pode preencher (temperatura e etapa não vêm da planilha: o lead entra frio). */
export const LEAD_FIELDS = {
  company_name: 'Empresa',
  contact_name: 'Contato',
  email: 'E-mail',
  phone: 'Telefone',
  website: 'Site',
  address_line: 'Endereço',
  city: 'Cidade',
  state: 'Estado (UF)',
  segment: 'Segmento',
  notes: 'Observações',
} as const
export type LeadField = keyof typeof LEAD_FIELDS
export type Mapping = (LeadField | '')[]

export const MAX_ROWS = 5000

const LIMITS: Record<LeadField, number> = {
  company_name: 200,
  contact_name: 200,
  email: 254,
  phone: 40,
  website: 2048,
  address_line: 300,
  city: 100,
  state: 60,
  segment: 100,
  notes: 5000,
}

// Nomes de coluna comuns (sem acento, minúsculos) → campo.
const SYNONYMS: [LeadField, string[]][] = [
  ['company_name', ['empresa', 'nome da empresa', 'razao social', 'nome fantasia', 'company', 'estabelecimento', 'negocio', 'cliente']],
  ['contact_name', ['contato', 'nome do contato', 'responsavel', 'nome', 'pessoa', 'proprietario', 'dono']],
  ['email', ['email', 'e-mail', 'e mail', 'correio', 'mail']],
  ['phone', ['telefone', 'celular', 'whatsapp', 'whats', 'fone', 'tel', 'phone', 'contato telefonico']],
  ['website', ['site', 'website', 'url', 'pagina', 'link']],
  ['address_line', ['endereco', 'logradouro', 'rua', 'address', 'endereco completo']],
  ['city', ['cidade', 'municipio', 'city']],
  ['state', ['uf', 'estado', 'state']],
  ['segment', ['segmento', 'categoria', 'ramo', 'nicho', 'atividade', 'setor', 'tipo']],
  ['notes', ['observacoes', 'observacao', 'obs', 'notas', 'nota', 'comentarios']],
]

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[_.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/** Sugere o campo de cada coluna pelo nome; cada campo é usado no máximo uma vez. */
export function suggestMapping(headers: string[]): Mapping {
  const used = new Set<LeadField>()
  return headers.map((h) => {
    const n = norm(h)
    const hit = SYNONYMS.find(([field, names]) => !used.has(field) && names.includes(n))
    if (!hit) return ''
    used.add(hit[0])
    return hit[0]
  })
}

export type ImportedLead = Partial<Record<LeadField, string>> & { company_name: string }

const looksLikeDomain = (v: string) => /^[^\s/]+\.[^\s]{2,}$/.test(v)

/** Uma linha da planilha → lead normalizado, ou o motivo da recusa. */
export function normalizeRow(values: Partial<Record<LeadField, string>>): { lead: ImportedLead } | { error: string } {
  const v: Partial<Record<LeadField, string>> = {}
  for (const [k, raw] of Object.entries(values) as [LeadField, string | undefined][]) {
    const t = (raw ?? '').trim()
    if (t) v[k] = t
  }
  if (!v.company_name) return { error: 'Sem o nome da empresa' }
  if (v.email) {
    v.email = v.email.toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) return { error: `E-mail inválido (${v.email})` }
  }
  if (v.phone) {
    const p = normalizePhone(v.phone)
    if (!p) return { error: `Telefone inválido (${v.phone})` }
    v.phone = p
  }
  if (v.website) {
    if (!/^https?:\/\//i.test(v.website) && looksLikeDomain(v.website)) v.website = `https://${v.website}`
    if (!/^https?:\/\/[^\s]+$/i.test(v.website)) return { error: `Site inválido (${v.website})` }
  }
  if (v.state && /^[a-z]{2}$/i.test(v.state)) v.state = v.state.toUpperCase()
  for (const [k, val] of Object.entries(v) as [LeadField, string][]) {
    if (val.length > LIMITS[k]) return { error: `${LEAD_FIELDS[k]} muito longo (máx. ${LIMITS[k]} caracteres)` }
  }
  return { lead: v as ImportedLead }
}

export type ExistingLead = { id: string; company_name: string } & Partial<Record<LeadField, string | null>>
export type DuplicateMode = 'skip' | 'fill'
export type LineIssue = { line: number; reason: string }

export type ImportPlan = {
  inserts: (ImportedLead & { line: number })[]
  updates: { id: string; line: number; patch: Partial<Record<LeadField, string>> }[]
  skipped: LineIssue[]
  errors: LineIssue[]
}

/**
 * Decide o destino de cada linha: novo, completar um existente (só campos vazios), ignorar (duplicado) ou
 * erro. Linha 1 é o cabeçalho; a primeira linha de dados é a linha 2 (como no Excel).
 */
export function planImport(rows: string[][], mapping: Mapping, existing: ExistingLead[], mode: DuplicateMode): ImportPlan {
  const plan: ImportPlan = { inserts: [], updates: [], skipped: [], errors: [] }
  const byEmail = new Map(existing.filter((e) => e.email).map((e) => [e.email!.toLowerCase(), e]))
  const byPhone = new Map(existing.filter((e) => e.phone).map((e) => [e.phone!, e]))
  const seenEmail = new Map<string, number>()
  const seenPhone = new Map<string, number>()
  const updated = new Set<string>()

  rows.forEach((cells, i) => {
    const line = i + 2
    const values: Partial<Record<LeadField, string>> = {}
    mapping.forEach((field, col) => {
      if (field && cells[col] !== undefined) values[field] = cells[col]
    })
    const r = normalizeRow(values)
    if ('error' in r) {
      plan.errors.push({ line, reason: r.error })
      return
    }
    const lead = r.lead
    const dupLine = (lead.email && seenEmail.get(lead.email)) || (lead.phone && seenPhone.get(lead.phone))
    if (dupLine) {
      plan.skipped.push({ line, reason: `Repetido no arquivo (igual à linha ${dupLine})` })
      return
    }
    if (lead.email) seenEmail.set(lead.email, line)
    if (lead.phone) seenPhone.set(lead.phone, line)

    const match = (lead.email && byEmail.get(lead.email)) || (lead.phone && byPhone.get(lead.phone)) || null
    if (!match) {
      plan.inserts.push({ ...lead, line })
      return
    }
    if (mode === 'skip' || updated.has(match.id)) {
      plan.skipped.push({ line, reason: `Já cadastrado (${match.company_name})` })
      return
    }
    const patch: Partial<Record<LeadField, string>> = {}
    for (const [k, val] of Object.entries(lead) as [LeadField, string][]) {
      const cur = match[k]
      if (val && (cur === null || cur === undefined || cur === '')) patch[k] = val
    }
    if (Object.keys(patch).length === 0) {
      plan.skipped.push({ line, reason: `Já cadastrado, nada a completar (${match.company_name})` })
      return
    }
    updated.add(match.id)
    plan.updates.push({ id: match.id, line, patch })
  })
  return plan
}

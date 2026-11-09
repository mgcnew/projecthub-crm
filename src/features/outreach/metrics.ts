/**
 * Métricas da prospecção (D142). Funções puras: recebem linhas já lidas do banco e devolvem os números da tela.
 * "Respondeu" = o lead tem uma resposta recebida DEPOIS de uma mensagem enviada ao grupo (não conta resposta
 * antiga, nem a de lead que nunca recebeu envio).
 */
export type SentRow = {
  lead_id: string
  sent_at: string
  channel: string
  temperature: string
  template_id: string | null
  template_name: string | null
  campaign_id: string | null
  campaign_name: string | null
}
export type ReplyRow = { lead_id: string; received_at: string }

export type RateRow = { key: string; label: string; contacted: number; replied: number; rate: number }

export type Dimension = 'campaign' | 'template' | 'channel' | 'temperature'

const keyOf = (r: SentRow, d: Dimension): { key: string; label: string } => {
  if (d === 'campaign') return { key: r.campaign_id ?? '-', label: r.campaign_name ?? 'Sem campanha' }
  if (d === 'template') return { key: r.template_id ?? '-', label: r.template_name ?? 'Sem modelo' }
  if (d === 'channel') return { key: r.channel, label: r.channel === 'email' ? 'E-mail' : 'WhatsApp' }
  return { key: r.temperature, label: ({ cold: 'Frios', warm: 'Mornos', hot: 'Quentes' } as Record<string, string>)[r.temperature] ?? r.temperature }
}

/** Taxa de resposta por dimensão: leads que responderam ÷ leads contatados (cada lead conta uma vez por grupo). */
export function replyRates(sent: SentRow[], replies: ReplyRow[], dimension: Dimension): RateRow[] {
  const repliesByLead = new Map<string, string[]>()
  for (const r of replies) {
    const list = repliesByLead.get(r.lead_id) ?? []
    list.push(r.received_at)
    repliesByLead.set(r.lead_id, list)
  }
  const groups = new Map<string, { label: string; firstSent: Map<string, string> }>()
  for (const s of sent) {
    const { key, label } = keyOf(s, dimension)
    const g = groups.get(key) ?? { label, firstSent: new Map<string, string>() }
    const prev = g.firstSent.get(s.lead_id)
    if (!prev || s.sent_at < prev) g.firstSent.set(s.lead_id, s.sent_at)
    groups.set(key, g)
  }
  const out: RateRow[] = []
  for (const [key, g] of groups) {
    let replied = 0
    for (const [leadId, firstSent] of g.firstSent) {
      if ((repliesByLead.get(leadId) ?? []).some((at) => at >= firstSent)) replied++
    }
    const contacted = g.firstSent.size
    out.push({ key, label: g.label, contacted, replied, rate: contacted === 0 ? 0 : replied / contacted })
  }
  return out.sort((a, b) => b.contacted - a.contacted || a.label.localeCompare(b.label, 'pt-BR'))
}

export type StageRow = { stage: string; count: number }
const STAGE_ORDER = ['new', 'contacted', 'replied', 'meeting', 'proposal', 'won', 'lost']

/** Quantos leads em cada etapa do funil, na ordem do funil (etapas sem lead aparecem com 0). */
export function stageCounts(leads: { stage: string }[]): StageRow[] {
  const counts = new Map<string, number>(STAGE_ORDER.map((s) => [s, 0]))
  for (const l of leads) counts.set(l.stage, (counts.get(l.stage) ?? 0) + 1)
  return [...counts].map(([stage, count]) => ({ stage, count }))
}

/** Leads convertidos em cliente desde o início do mês (`monthStartISO`, ex.: "2026-11-01"). */
export function convertedSince(leads: { converted_at: string | null }[], monthStartISO: string): number {
  return leads.filter((l) => l.converted_at !== null && l.converted_at.slice(0, 10) >= monthStartISO).length
}

export const percent = (rate: number) => `${Math.round(rate * 100)}%`

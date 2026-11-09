import type { Channel } from './schema'

/**
 * Quem pode receber um rascunho de um modelo (D129). O banco confere tudo de novo ao inserir e ao aprovar;
 * isto só evita tentar o que vai falhar e explica por que cada lead ficou de fora.
 */
export type QueueLead = {
  id: string
  company_name: string
  contact_name: string | null
  email: string | null
  phone: string | null
  hook: string | null
  temperature: string
  product_id: string | null
  opted_out_at: string | null
  archived_at: string | null
}

export type SkipReason = 'sem-contato' | 'nao-contatar' | 'arquivado' | 'suprimido' | 'temperatura' | 'ja-na-fila'

export const skipLabels: Record<SkipReason, string> = {
  'sem-contato': 'sem e-mail/telefone para o canal',
  'nao-contatar': 'marcado como "não contatar"',
  arquivado: 'arquivado',
  suprimido: 'na lista de supressão',
  temperatura: 'temperatura fora do público do modelo',
  'ja-na-fila': 'já tem este modelo na fila',
}

/** Endereço de destino do lead no canal: e-mail em minúsculo ou telefone E.164. */
export function leadAddress(channel: Channel, lead: Pick<QueueLead, 'email' | 'phone'>): string | null {
  const v = channel === 'email' ? lead.email?.trim().toLowerCase() : lead.phone?.trim()
  return v ? v : null
}

export function eligibility(input: {
  template: { channel: Channel; temperature: string | null }
  lead: QueueLead
  /** Valores da lista de supressão (e-mails minúsculos e telefones). */
  suppressed: ReadonlySet<string>
  /** Ids dos leads que já têm este modelo em rascunho, aprovada ou enviando. */
  queued: ReadonlySet<string>
}): { ok: true } | { ok: false; reason: SkipReason } {
  const { template, lead } = input
  if (lead.archived_at) return { ok: false, reason: 'arquivado' }
  if (lead.opted_out_at) return { ok: false, reason: 'nao-contatar' }
  const address = leadAddress(template.channel, lead)
  if (!address) return { ok: false, reason: 'sem-contato' }
  if (input.suppressed.has(address)) return { ok: false, reason: 'suprimido' }
  const temperatureOk = template.temperature
    ? lead.temperature === template.temperature
    : template.channel === 'email' || lead.temperature === 'warm' || lead.temperature === 'hot'
  if (!temperatureOk) return { ok: false, reason: 'temperatura' }
  if (input.queued.has(lead.id)) return { ok: false, reason: 'ja-na-fila' }
  return { ok: true }
}

/** Separa os leads em elegíveis e descartados (com a contagem por motivo). */
export function splitEligible(input: {
  template: { channel: Channel; temperature: string | null }
  leads: QueueLead[]
  suppressed: ReadonlySet<string>
  queued: ReadonlySet<string>
}) {
  const eligible: QueueLead[] = []
  const skipped = new Map<SkipReason, number>()
  for (const lead of input.leads) {
    const r = eligibility({ template: input.template, lead, suppressed: input.suppressed, queued: input.queued })
    if (r.ok) eligible.push(lead)
    else skipped.set(r.reason, (skipped.get(r.reason) ?? 0) + 1)
  }
  return { eligible, skipped }
}

/**
 * Leads de uma campanha que esperam um rascunho: o passo 1 ainda não gerado ou um lembrete cuja data já chegou.
 * `maxStep` = 1 + número de lembretes. Só quem segue na sequência (`active`) entra.
 */
export function pendingCampaignRows<T extends { status: string; step: number; next_step_on: string | null }>(rows: T[], maxStep: number, today: string): T[] {
  return rows.filter((r) => r.status === 'active' && (r.step === 0 || (r.step < maxStep && r.next_step_on !== null && r.next_step_on <= today)))
}

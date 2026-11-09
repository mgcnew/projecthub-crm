/** Interpretação dos webhooks: Resend (bounce e reclamação) e Evolution (mensagens recebidas e conexão). */

export type ResendEvent = { kind: 'bounce' | 'complaint'; email: string } | null

/** `email.bounced` e `email.complained` suprimem o endereço; os demais eventos são ignorados. */
export function parseResendEvent(payload: unknown): ResendEvent[] {
  const p = payload as { type?: string; data?: { to?: string[] | string; email_to?: string[] | string } } | null
  if (!p || typeof p.type !== 'string') return []
  const kind = p.type === 'email.bounced' ? 'bounce' : p.type === 'email.complained' ? 'complaint' : null
  if (!kind) return []
  const raw = p.data?.to ?? p.data?.email_to
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? [raw] : []
  return list.filter((e): e is string => typeof e === 'string' && e.includes('@')).map((e) => ({ kind, email: e.trim().toLowerCase() }))
}

export type EvolutionEvent =
  | { kind: 'message'; phone: string; text: string; id: string; at: string }
  | { kind: 'connection'; state: 'open' | 'connecting' | 'close' }
  | null

/**
 * `messages.upsert` (mensagem recebida, nunca as enviadas por nós nem de grupos) e `connection.update`.
 * O telefone sai em E.164 (`+5511912345678`).
 */
export function parseEvolutionEvent(payload: unknown): EvolutionEvent {
  const p = payload as { event?: string; data?: Record<string, unknown> } | null
  if (!p || typeof p.event !== 'string' || !p.data) return null
  const event = p.event.toLowerCase().replace(/_/g, '.')

  if (event === 'connection.update') {
    const state = (p.data as { state?: string }).state
    return state === 'open' || state === 'connecting' || state === 'close' ? { kind: 'connection', state } : null
  }
  if (event === 'messages.upsert') {
    const d = p.data as {
      key?: { remoteJid?: string; fromMe?: boolean; id?: string }
      message?: { conversation?: string; extendedTextMessage?: { text?: string } }
      messageTimestamp?: number | string
    }
    const jid = d.key?.remoteJid ?? ''
    if (d.key?.fromMe || !jid.endsWith('@s.whatsapp.net') || !d.key?.id) return null
    const text = d.message?.conversation ?? d.message?.extendedTextMessage?.text
    if (!text || !text.trim()) return null
    const phoneDigits = jid.split('@')[0].replace(/\D/g, '')
    if (phoneDigits.length < 8) return null
    const ts = Number(d.messageTimestamp)
    const at = Number.isFinite(ts) && ts > 0 ? new Date(ts * 1000).toISOString() : new Date().toISOString()
    return { kind: 'message', phone: `+${phoneDigits}`, text: text.trim().slice(0, 4000), id: d.key.id, at }
  }
  return null
}

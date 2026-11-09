/** Verificação da assinatura Svix dos webhooks do Resend (`svix-id`, `svix-timestamp`, `svix-signature`). */
import { safeEqual } from './unsubscribe.ts'

const enc = new TextEncoder()
const TOLERANCE_S = 5 * 60

export async function verifySvix(input: {
  secret: string // "whsec_<base64>"
  id: string | null
  timestamp: string | null
  signature: string | null
  body: string
  nowS?: number
}): Promise<boolean> {
  const { id, timestamp, signature } = input
  if (!id || !timestamp || !signature) return false
  const now = input.nowS ?? Math.floor(Date.now() / 1000)
  const ts = Number(timestamp)
  if (!Number.isFinite(ts) || Math.abs(now - ts) > TOLERANCE_S) return false
  let keyBytes: Uint8Array
  try {
    const raw = input.secret.startsWith('whsec_') ? input.secret.slice(6) : input.secret
    keyBytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0))
  } catch {
    return false
  }
  const key = await crypto.subtle.importKey('raw', keyBytes as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const expected = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(`${id}.${timestamp}.${input.body}`)))
  // O cabeçalho pode ter várias assinaturas ("v1,abc v1,def").
  for (const part of signature.split(' ')) {
    const [version, b64] = part.split(',')
    if (version !== 'v1' || !b64) continue
    try {
      if (safeEqual(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)), expected)) return true
    } catch {
      // assinatura malformada: tenta a próxima
    }
  }
  return false
}

/** Link de descadastro assinado (HMAC-SHA256): só quem recebeu o e-mail consegue gerar um link válido. */
const enc = new TextEncoder()

const toB64Url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const fromB64Url = (s: string) => {
  const pad = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)
  return Uint8Array.from(atob(pad), (c) => c.charCodeAt(0))
}

async function hmac(secret: string, data: string) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data)))
}

/** Comparação em tempo constante. */
export function safeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

export async function signUnsubscribe(secret: string, orgId: string, leadId: string): Promise<string> {
  const payload = `${orgId}.${leadId}`
  return `${toB64Url(enc.encode(payload))}.${toB64Url(await hmac(secret, payload))}`
}

export async function verifyUnsubscribe(secret: string, token: string): Promise<{ orgId: string; leadId: string } | null> {
  const [p, sig] = token.split('.')
  if (!p || !sig || token.split('.').length !== 2) return null
  try {
    const payload = new TextDecoder().decode(fromB64Url(p))
    const ok = safeEqual(fromB64Url(sig), await hmac(secret, payload))
    const [orgId, leadId] = payload.split('.')
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!ok || !uuid.test(orgId ?? '') || !uuid.test(leadId ?? '')) return null
    return { orgId, leadId }
  } catch {
    return null
  }
}

export const emailFooter = (url: string) => `\n\n--\nPara não receber mais mensagens, acesse: ${url}`
export const whatsappFooter = '\n\nResponda SAIR para não receber mais mensagens.'

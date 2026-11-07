/**
 * Criptografia do cofre (D120). Tudo roda no navegador, com Web Crypto; o servidor nunca vê a senha mestra,
 * a chave de dados nem o conteúdo guardado.
 *
 *   senha mestra ──PBKDF2-SHA256(sal, N iterações)──▶ 64 bytes = chave do cliente (32) ‖ prova (32)
 *   prova ──────────────────────────────▶ enviada ao servidor, que confere e conta as tentativas
 *   chave do cliente ‖ parte do servidor ──HKDF-SHA256──▶ chave de embrulho (AES-GCM 256)
 *   chave de dados (DEK, aleatória) ──embrulhada pela chave de embrulho──▶ guardada no banco
 *   item {senha, notas} ──AES-GCM com a DEK (AAD = id do acesso)──▶ IV + texto cifrado no banco
 */

export const KDF_ITERATIONS = 600_000
const te = new TextEncoder()
const td = new TextDecoder()

export type VaultSecret = { password: string; notes: string }
export type Sealed = { iv: Uint8Array<ArrayBuffer>; data: Uint8Array<ArrayBuffer> }

export function randomBytes(n: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(n))
}

/** Normaliza a senha mestra (NFKC) para o mesmo texto render a mesma chave em qualquer teclado. */
const normalize = (s: string) => te.encode(s.normalize('NFKC'))

export function concatBytes(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

/** Deriva a chave do cliente e a prova da senha mestra. */
export async function deriveKeys(masterPassword: string, salt: Uint8Array<ArrayBuffer>, iterations: number) {
  const base = await crypto.subtle.importKey('raw', normalize(masterPassword), 'PBKDF2', false, ['deriveBits'])
  const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, base, 512))
  return { clientKey: bits.slice(0, 32), proof: bits.slice(32, 64) }
}

export type WrapPurpose = 'embrulho' | 'backup'

async function wrappingKey(clientKey: Uint8Array<ArrayBuffer>, share: Uint8Array<ArrayBuffer>, purpose: WrapPurpose) {
  const ikm = await crypto.subtle.importKey('raw', concatBytes(clientKey, share), 'HKDF', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: te.encode(`voltier-cofre-v1-${purpose}`) },
    ikm,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

/** Embrulha a DEK (32 bytes) → 48 bytes (DEK cifrada + etiqueta GCM). */
export async function wrapDek(
  clientKey: Uint8Array<ArrayBuffer>,
  share: Uint8Array<ArrayBuffer>,
  dek: Uint8Array<ArrayBuffer>,
  purpose: WrapPurpose = 'embrulho',
): Promise<Sealed> {
  const iv = randomBytes(12)
  const key = await wrappingKey(clientKey, share, purpose)
  return { iv, data: new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, dek)) }
}

/** Abre a DEK embrulhada; falha (exceção) se a chave do cliente ou a parte do servidor não conferem. */
export async function unwrapDek(
  clientKey: Uint8Array<ArrayBuffer>,
  share: Uint8Array<ArrayBuffer>,
  wrapped: Uint8Array<ArrayBuffer>,
  iv: Uint8Array<ArrayBuffer>,
  purpose: WrapPurpose = 'embrulho',
): Promise<Uint8Array<ArrayBuffer>> {
  const key = await wrappingKey(clientKey, share, purpose)
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, wrapped))
}

/** DEK como chave não extraível (fica só na memória da sessão destravada). */
export function importDek(dek: Uint8Array<ArrayBuffer>) {
  return crypto.subtle.importKey('raw', dek, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

/** Material de um cofre novo, tudo gerado aqui. */
export async function createVaultMaterial(masterPassword: string, iterations = KDF_ITERATIONS) {
  const salt = randomBytes(16)
  const share = randomBytes(32)
  const dek = randomBytes(32)
  const { clientKey, proof } = await deriveKeys(masterPassword, salt, iterations)
  const wrapped = await wrapDek(clientKey, share, dek)
  return { salt, iterations, proof, share, wrappedDek: wrapped.data, dekIv: wrapped.iv, dek }
}

/** Cifra o item de um acesso; o id do acesso entra como dado autenticado (um item não vale em outro acesso). */
export async function encryptSecret(dek: CryptoKey, accessId: string, secret: VaultSecret): Promise<Sealed> {
  const iv = randomBytes(12)
  const plain = te.encode(JSON.stringify({ v: 1, password: secret.password, notes: secret.notes }))
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: te.encode(accessId) }, dek, plain))
  return { iv, data }
}

export async function decryptSecret(dek: CryptoKey, accessId: string, sealed: Sealed): Promise<VaultSecret> {
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: sealed.iv, additionalData: te.encode(accessId) }, dek, sealed.data)
  const parsed = JSON.parse(td.decode(plain)) as { password?: unknown; notes?: unknown }
  return { password: typeof parsed.password === 'string' ? parsed.password : '', notes: typeof parsed.notes === 'string' ? parsed.notes : '' }
}

// ----- bytea ↔ PostgREST ("\x" + hex) -----

export function toBytea(b: Uint8Array): string {
  return '\\x' + Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
}

export function fromBytea(v: string): Uint8Array<ArrayBuffer> {
  const hex = v.startsWith('\\x') ? v.slice(2) : v
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return out
}

/** Regras da senha mestra: longa o bastante para resistir a tentativas offline (o PBKDF2 só encarece). */
export function masterPasswordIssues(pw: string): string[] {
  const issues: string[] = []
  if (pw.length < 14) issues.push('Use 14 caracteres ou mais (uma frase longa é melhor que uma senha curta).')
  if (!/[a-z]/.test(pw) || !/[A-Z]/.test(pw) || !/[0-9]/.test(pw)) issues.push('Misture maiúsculas, minúsculas e números.')
  return issues
}

export function toBase64(b: Uint8Array): string {
  let bin = ''
  for (const x of b) bin += String.fromCharCode(x)
  return btoa(bin)
}

export function fromBase64(v: string): Uint8Array<ArrayBuffer> {
  const bin = atob(v)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

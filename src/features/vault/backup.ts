import { z } from 'zod'
import { deriveKeys, fromBase64, toBase64, unwrapDek, wrapDek } from '@/lib/vaultCrypto'

/**
 * Backup do cofre (arquivo que o usuário guarda fora do app). Contém o sal, a chave de dados embrulhada
 * SÓ pela senha mestra (sem a parte do servidor, que não faz parte do arquivo) e os itens já cifrados.
 * Quem tiver o arquivo e a senha mestra abre tudo: guarde-o como guardaria uma senha.
 */
const b64 = z.string().max(40_000).regex(/^[A-Za-z0-9+/]*={0,2}$/)

export const backupSchema = z.object({
  format: z.literal('voltier-cofre-backup'),
  version: z.literal(1),
  exportedAt: z.string(),
  kdf: z.object({ iterations: z.number().int().min(600_000).max(5_000_000), salt: b64 }),
  wrappedDek: z.object({ iv: b64, data: b64 }),
  items: z
    .array(
      z.object({
        accessId: z.uuid(),
        accessName: z.string().max(200),
        iv: b64,
        data: b64,
      }),
    )
    .max(2000),
})
export type BackupFile = z.infer<typeof backupSchema>

export type BackupItem = { accessId: string; accessName: string; iv: Uint8Array<ArrayBuffer>; data: Uint8Array<ArrayBuffer> }

/** Monta o arquivo a partir da DEK aberta e da chave do cliente (derivada da senha mestra). */
export async function buildBackup(input: {
  clientKey: Uint8Array<ArrayBuffer>
  salt: Uint8Array<ArrayBuffer>
  iterations: number
  dek: Uint8Array<ArrayBuffer>
  items: BackupItem[]
  now?: Date
}): Promise<BackupFile> {
  const wrapped = await wrapDek(input.clientKey, new Uint8Array(32), input.dek, 'backup')
  return {
    format: 'voltier-cofre-backup',
    version: 1,
    exportedAt: (input.now ?? new Date()).toISOString(),
    kdf: { iterations: input.iterations, salt: toBase64(input.salt) },
    wrappedDek: { iv: toBase64(wrapped.iv), data: toBase64(wrapped.data) },
    items: input.items.map((i) => ({ accessId: i.accessId, accessName: i.accessName, iv: toBase64(i.iv), data: toBase64(i.data) })),
  }
}

export class BackupError extends Error {
  constructor(readonly reason: 'invalid' | 'password') {
    super(reason)
  }
}

/** Valida o arquivo e abre a DEK com a senha mestra do backup. `password` = erro de senha. */
export async function openBackup(raw: unknown, masterPassword: string) {
  const parsed = backupSchema.safeParse(raw)
  if (!parsed.success) throw new BackupError('invalid')
  const file = parsed.data
  const salt = fromBase64(file.kdf.salt)
  if (salt.length !== 16) throw new BackupError('invalid')
  const keys = await deriveKeys(masterPassword, salt, file.kdf.iterations)
  let dek: Uint8Array<ArrayBuffer>
  try {
    dek = await unwrapDek(keys.clientKey, new Uint8Array(32), fromBase64(file.wrappedDek.data), fromBase64(file.wrappedDek.iv), 'backup')
  } catch {
    throw new BackupError('password')
  }
  return {
    dek,
    salt,
    iterations: file.kdf.iterations,
    clientKey: keys.clientKey,
    proof: keys.proof,
    items: file.items.map((i) => ({ accessId: i.accessId, accessName: i.accessName, iv: fromBase64(i.iv), data: fromBase64(i.data) })),
  }
}

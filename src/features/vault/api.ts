import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { fromBytea, toBytea, type Sealed } from '@/lib/vaultCrypto'

export type VaultMeta = {
  organizationId: string
  salt: Uint8Array<ArrayBuffer>
  iterations: number
  wrappedDek: Uint8Array<ArrayBuffer>
  dekIv: Uint8Array<ArrayBuffer>
  maxAttempts: number
  failedAttempts: number
  lockedUntil: string | null
  createdAt: string
}

export const vaultKeys = {
  meta: (orgId: string | undefined) => ['vault', 'meta', orgId] as const,
  items: (orgId: string | undefined) => ['vault', 'items', orgId] as const,
  item: (accessId: string) => ['vault', 'item', accessId] as const,
}

/** Parâmetros públicos do cofre (sal, chave embrulhada, tentativas). Sem cofre: `null`. */
export function useVaultMeta(orgId: string | undefined) {
  return useQuery({
    queryKey: vaultKeys.meta(orgId),
    enabled: Boolean(orgId),
    staleTime: 0,
    queryFn: async (): Promise<VaultMeta | null> => {
      const { data, error } = await supabase
        .from('vault_meta')
        .select('organization_id, salt, kdf_iterations, wrapped_dek, dek_iv, max_attempts, failed_attempts, locked_until, created_at')
        .eq('organization_id', orgId!)
        .maybeSingle()
      if (error) throw error
      if (!data) return null
      return {
        organizationId: data.organization_id,
        salt: fromBytea(data.salt),
        iterations: data.kdf_iterations,
        wrappedDek: fromBytea(data.wrapped_dek),
        dekIv: fromBytea(data.dek_iv),
        maxAttempts: data.max_attempts,
        failedAttempts: data.failed_attempts,
        lockedUntil: data.locked_until,
        createdAt: data.created_at,
      }
    },
  })
}

export type UnlockRpc = {
  status: 'ok' | 'wrong' | 'locked' | 'destroyed' | 'missing'
  share: Uint8Array<ArrayBuffer> | null
  attemptsLeft: number | null
  retryAt: string | null
}

const STATUSES = new Set(['ok', 'wrong', 'locked', 'destroyed', 'missing'])

/** Confere a prova da senha mestra no servidor (conta as tentativas) e recebe a parte do servidor. */
export async function rpcUnlock(orgId: string, proof: Uint8Array): Promise<UnlockRpc> {
  const { data, error } = await supabase.rpc('vault_unlock', { p_organization: orgId, p_proof: toBytea(proof) })
  if (error) throw error
  const row = data?.[0]
  if (!row || !STATUSES.has(row.status)) throw new Error('Resposta inesperada do cofre')
  return {
    status: row.status as UnlockRpc['status'],
    share: row.share ? fromBytea(row.share) : null,
    attemptsLeft: row.attempts_left ?? null,
    retryAt: row.retry_at ?? null,
  }
}

export type SetupInput = {
  orgId: string
  salt: Uint8Array
  iterations: number
  proof: Uint8Array
  share: Uint8Array
  wrappedDek: Uint8Array
  dekIv: Uint8Array
  maxAttempts: number
}

export function useSetupVault() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (i: SetupInput) => {
      const { error } = await supabase.rpc('vault_setup', {
        p_organization: i.orgId,
        p_salt: toBytea(i.salt),
        p_iterations: i.iterations,
        p_proof: toBytea(i.proof),
        p_share: toBytea(i.share),
        p_wrapped_dek: toBytea(i.wrappedDek),
        p_dek_iv: toBytea(i.dekIv),
        p_max_attempts: i.maxAttempts,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vault'] }),
  })
}

export type RekeyInput = {
  orgId: string
  oldProof: Uint8Array
  newProof: Uint8Array
  salt: Uint8Array
  iterations: number
  wrappedDek: Uint8Array
  dekIv: Uint8Array
}

export function useRekeyVault() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (i: RekeyInput) => {
      const { data, error } = await supabase.rpc('vault_rekey', {
        p_organization: i.orgId,
        p_old_proof: toBytea(i.oldProof),
        p_new_proof: toBytea(i.newProof),
        p_salt: toBytea(i.salt),
        p_iterations: i.iterations,
        p_wrapped_dek: toBytea(i.wrappedDek),
        p_dek_iv: toBytea(i.dekIv),
      })
      if (error) throw error
      return data?.[0]?.status ?? 'missing'
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vault'] }),
  })
}

export function useDestroyVault() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (orgId: string) => {
      const { error } = await supabase.rpc('vault_destroy', { p_organization: orgId })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vault'] }),
  })
}

/** Quais acessos já têm senha no cofre (só o id; o conteúdo continua cifrado). */
export function useVaultItemIds(orgId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: vaultKeys.items(orgId),
    enabled: Boolean(orgId) && enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from('vault_items').select('access_id').limit(2000)
      if (error) throw error
      return new Set((data ?? []).map((r) => r.access_id))
    },
  })
}

export function useVaultItem(accessId: string, enabled: boolean) {
  return useQuery({
    queryKey: vaultKeys.item(accessId),
    enabled,
    queryFn: async (): Promise<{ iv: Uint8Array<ArrayBuffer>; data: Uint8Array<ArrayBuffer> } | null> => {
      const { data, error } = await supabase.from('vault_items').select('iv, ciphertext').eq('access_id', accessId).maybeSingle()
      if (error) throw error
      return data ? { iv: fromBytea(data.iv), data: fromBytea(data.ciphertext) } : null
    },
  })
}

/** Grava o item já cifrado: atualiza se existe, cria se não. */
export function useSaveVaultItem(orgId: string | undefined, accessId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (sealed: Sealed) => {
      if (!orgId) throw new Error('Organização não carregada')
      const row = { iv: toBytea(sealed.iv), ciphertext: toBytea(sealed.data) }
      const upd = await supabase.from('vault_items').update(row).eq('access_id', accessId).select('id')
      if (upd.error) throw upd.error
      if (upd.data.length === 0) {
        const ins = await supabase.from('vault_items').insert({ organization_id: orgId, access_id: accessId, ...row })
        if (ins.error) throw ins.error
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: vaultKeys.item(accessId) })
      void qc.invalidateQueries({ queryKey: vaultKeys.items(orgId) })
    },
  })
}

export function useDeleteVaultItem(orgId: string | undefined, accessId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('vault_items').delete().eq('access_id', accessId)
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: vaultKeys.item(accessId) })
      void qc.invalidateQueries({ queryKey: vaultKeys.items(orgId) })
    },
  })
}

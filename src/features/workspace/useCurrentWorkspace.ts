import { useAuth } from '@/features/auth/auth-context'
import { useWorkspaces } from './useWorkspace'

/** Primeira organização ativa do usuário. Escrita só para owner (RLS é a autoridade; isto é só UX). */
export function useCurrentWorkspace() {
  const { session } = useAuth()
  const q = useWorkspaces(session?.user.id)
  const workspace = q.data?.[0]
  return {
    workspace,
    orgId: workspace?.id,
    canWrite: workspace?.role === 'owner',
    isPending: q.isPending,
    isError: q.isError,
    refetch: q.refetch,
  }
}

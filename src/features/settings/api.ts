import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useUserPreferences(userId: string | undefined) {
  return useQuery({
    queryKey: ['preferences', userId],
    enabled: Boolean(userId),
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('timezone')
        .eq('user_id', userId!)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

/** Atualiza ou cria a preferência (sem upsert: o cliente não tem UPDATE em user_id). */
export function useSaveTimezone(userId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (timezone: string) => {
      if (!userId) throw new Error('Sessão não carregada')
      const { data, error } = await supabase
        .from('user_preferences')
        .update({ timezone })
        .eq('user_id', userId)
        .select('user_id')
      if (error) throw error
      if (data.length === 0) {
        const { error: e2 } = await supabase.from('user_preferences').insert({ user_id: userId, timezone })
        if (e2) throw e2
      }
      return timezone
    },
    onSuccess: (timezone) => qc.setQueryData(['preferences', userId], { timezone }),
  })
}

/** Perfil do usuário (nome exibido). O cliente só lê e altera o próprio (RLS + privilégio por coluna). */
export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ['profile', userId],
    enabled: Boolean(userId),
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('display_name').eq('id', userId!).maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export function useSaveProfile(userId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (display_name: string) => {
      if (!userId) throw new Error('Sessão não carregada')
      const { data, error } = await supabase.from('profiles').update({ display_name }).eq('id', userId).select('display_name')
      if (error) throw error
      if (data.length === 0) throw new Error('Perfil não encontrado')
      return display_name
    },
    onSuccess: (display_name) => qc.setQueryData(['profile', userId], { display_name }),
  })
}

/** Renomeia o espaço de trabalho (só o proprietário; a RLS é a autoridade). */
export function useRenameWorkspace() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { data, error } = await supabase.from('organizations').update({ name }).eq('id', id).select('id')
      if (error) throw error
      if (data.length === 0) throw new Error('Sem permissão')
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workspaces'] }),
  })
}

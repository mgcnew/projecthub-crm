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

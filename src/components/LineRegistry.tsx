import { Fragment, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { setProjectOrder } from '@/lib/lines'
import { supabase } from '@/lib/supabase'

/**
 * Carrega a ordem de criação dos projetos (inclusive arquivados, para a cor não mudar ao arquivar) e
 * registra as linhas antes de renderizar as telas; remonta quando um projeto novo entra.
 */
export function LineRegistry({ children }: { children: ReactNode }) {
  const q = useQuery({
    queryKey: ['projects', 'line-order'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('projects').select('id').order('created_at').order('id')
      if (error) throw error
      return (data ?? []).map((p) => p.id)
    },
  })
  const ids = q.data ?? []
  setProjectOrder(ids)
  return <Fragment key={ids.length}>{children}</Fragment>
}

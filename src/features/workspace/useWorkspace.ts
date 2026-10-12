import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type Workspace = { id: string; name: string; role: string }

/** Organizações do usuário (RLS já restringe a vínculos ativos). */
export function useWorkspaces(userId: string | undefined) {
  return useQuery({
    queryKey: ['workspaces', userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<Workspace[]> => {
      const { data, error } = await supabase
        .from('organization_members')
        .select('role, organizations(id, name)')
        .order('joined_at', { ascending: true })
      if (error) throw error
      return (data ?? []).flatMap((row) =>
        row.organizations
          ? [{ id: row.organizations.id, name: row.organizations.name, role: row.role }]
          : [],
      )
    },
  })
}

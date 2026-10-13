import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-context'
import { formatDateTime } from '@/lib/format'
import { supabase } from '@/lib/supabase'
import { describeActivity } from './describe'

type EntityType = 'task' | 'project' | 'client' | 'calendar_event'

// A chave fica sob a raiz da entidade para ser invalidada junto com as mutações dela.
const cacheRoot: Record<EntityType, string> = {
  task: 'tasks',
  project: 'projects',
  client: 'clients',
  calendar_event: 'calendar',
}

function useActivity(entityType: EntityType, entityId: string) {
  return useQuery({
    queryKey: [cacheRoot[entityType], 'activity', entityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('id, actor_id, action, changes, created_at')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('created_at', { ascending: false })
        .limit(20)
      if (error) throw error
      return data ?? []
    },
  })
}

/** Histórico de alterações (gravado por trigger no banco; somente leitura). */
export function ActivityTimeline({ entityType, entityId }: { entityType: EntityType; entityId: string }) {
  const { session } = useAuth()
  const q = useActivity(entityType, entityId)
  const me = session?.user.id

  return (
    <section aria-labelledby="activity-h" className="space-y-3">
      <h2 id="activity-h" className="section-title">
        Histórico de atividade
      </h2>
      {q.isPending && <p role="status" className="text-sm text-muted-foreground">Carregando…</p>}
      {q.isError && <p role="alert" className="text-sm text-destructive">Não foi possível carregar o histórico.</p>}
      {q.isSuccess && q.data.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhuma atividade registrada.</p>
      )}
      {(q.data ?? []).length > 0 && (
        <ol className="plate divide-y divide-border">
          {q.data!.map((a) => (
            <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-x-4 px-4 py-2">
              <span className="text-sm">
                <span className="font-medium">{a.actor_id === me ? 'Você' : a.actor_id ? 'Outro membro' : 'Sistema'}</span>{' '}
                {describeActivity(a)}
              </span>
              <time className="text-sm text-muted-foreground" dateTime={a.created_at}>
                {formatDateTime(a.created_at)}
              </time>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

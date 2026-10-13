import { Building2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { LineBadge } from '@/components/LineBadge'
import { LoadingState } from '@/components/states'
import { useAuth } from '@/features/auth/auth-context'
import { describeActivity } from '@/features/activity/describe'
import { entityHref, entityLabel, relativeTime } from '@/features/activity/feed'
import { formatDateTime } from '@/lib/format'
import { useRecentActivity } from './api'

/** "Atividade recente": o que mudou na organização, com o título atual e a linha do projeto. */
export function ActivityFeed({ enabled }: { enabled: boolean }) {
  const { session } = useAuth()
  const q = useRecentActivity(enabled)
  const me = session?.user.id

  if (q.isPending) return <LoadingState rows={3} />
  if (q.isError) return <p role="alert" className="py-2 text-sm font-medium text-destructive">Não foi possível carregar a atividade.</p>
  if (q.data.length === 0) return <p className="py-2 text-sm text-muted-foreground">Nenhuma atividade registrada ainda.</p>

  return (
    <ol className="divide-y divide-border">
      {q.data.map((a) => {
        const e = a.entity
        const fallback = (a.changes as { title?: string } | null)?.title ?? null
        const title = e?.title ?? fallback ?? 'Registro indisponível'
        const who = a.actor_id === me ? 'Você' : a.actor_id ? 'Outro membro' : 'Sistema'
        const what = a.action === 'created' ? 'criou' : describeActivity(a)
        const label = entityLabel(a.entity_type, e?.eventType)
        return (
          <li key={a.id} className="flex items-start gap-3 py-2.5">
            {a.entity_type === 'client' ? (
              <span aria-hidden="true" className="inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-border">
                <Building2 className="size-3.5" />
              </span>
            ) : (
              <LineBadge projectId={e?.projectId ?? null} projectName={e?.projectName ?? null} />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate leading-6">
                {e ? (
                  <Link to={entityHref(a.entity_type, a.entity_id, e.eventType)} className="-my-2.5 inline-block py-2.5 font-semibold hover:underline">
                    {title}
                  </Link>
                ) : (
                  <span className="font-semibold text-muted-foreground">{title}</span>
                )}
              </p>
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold">{label}</span> · {who} {what}
              </p>
            </div>
            <time dateTime={a.created_at} title={formatDateTime(a.created_at)} className="shrink-0 pt-0.5 text-sm text-muted-foreground tabular-nums">
              {relativeTime(a.created_at)}
            </time>
          </li>
        )
      })}
    </ol>
  )
}

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge } from '@/components/states'
import { useCurrentWorkspace } from '@/features/workspace/useCurrentWorkspace'
import { formatDateTime } from '@/lib/format'
import { notificationHref } from './schema'
import { NOTIFICATIONS_PAGE_SIZE, useNotificationMutations, useNotifications, useUnreadCount } from './api'

export function NotificationsPage() {
  const { orgId } = useCurrentWorkspace()
  const [page, setPage] = useState(0)
  const q = useNotifications(page, Boolean(orgId))
  const unread = useUnreadCount(Boolean(orgId))
  const { markRead, markAllRead } = useNotificationMutations()

  const rows = q.data?.rows ?? []
  const count = q.data?.count ?? 0
  const pages = Math.max(1, Math.ceil(count / NOTIFICATIONS_PAGE_SIZE))

  return (
    <>
      <PageHeader
        title="Notificações"
        description={unread.data ? `${unread.data} não lida${unread.data > 1 ? 's' : ''}` : undefined}
        actions={
          (unread.data ?? 0) > 0 && (
            <Button variant="outline" disabled={markAllRead.isPending} onClick={() => markAllRead.mutate()}>
              Marcar todas como lidas
            </Button>
          )
        }
      />

      {q.isPending && <LoadingState />}
      {q.isError && <ErrorState message="Não foi possível carregar as notificações." onRetry={() => q.refetch()} />}
      {q.isSuccess && rows.length === 0 && (
        <EmptyState
          title="Nenhuma notificação"
          description="Os lembretes de tarefas e eventos aparecem aqui quando chegam na hora."
        />
      )}

      {rows.length > 0 && (
        <ul className="plate divide-y divide-border">
          {rows.map((n) => {
            const href = notificationHref(n)
            const isNew = n.read_at === null
            return (
              <li key={n.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className={isNew ? 'font-semibold' : 'text-muted-foreground'}>
                    {href ? (
                      <Link to={href} className="hover:underline" onClick={() => isNew && markRead.mutate(n.id)}>
                        {n.title}
                      </Link>
                    ) : (
                      n.title
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {n.body ? `${n.body} · ` : ''}
                    {formatDateTime(n.created_at)}
                  </p>
                </div>
                {isNew ? (
                  <>
                    <StatusBadge tone="info">Nova</StatusBadge>
                    <Button variant="ghost" size="sm" disabled={markRead.isPending} onClick={() => markRead.mutate(n.id)}>
                      Marcar como lida
                    </Button>
                  </>
                ) : (
                  <StatusBadge>Lida</StatusBadge>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-between">
          <Button variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {page + 1} de {pages}
          </span>
          <Button variant="outline" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>
            Próxima
          </Button>
        </div>
      )}
    </>
  )
}

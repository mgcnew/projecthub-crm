import { Link } from 'react-router-dom'
import { Plate } from '@/components/Plate'
import { StatusBadge } from '@/components/states'
import { formatDate } from '@/lib/format'
import { useFollowUps } from './api'

/** "Contatos a fazer" na Central do dia: próximo contato vencido ou dos próximos dias. Some quando vazia. */
export function FollowUpsPlate({ today, endDate, enabled }: { today: string; endDate: string; enabled: boolean }) {
  const q = useFollowUps(endDate, enabled)
  const rows = q.data ?? []
  if (rows.length === 0) return null
  return (
    <Plate id="dash-followups" title="Contatos a fazer" meta={`${rows.length} cliente${rows.length === 1 ? '' : 's'}`}>
      <ul>
        {rows.map((c) => {
          const late = (c.next_contact_on ?? '') < today
          return (
            <li key={c.id} className="border-b border-border last:border-b-0">
              <Link
                to={`/app/clientes/${c.id}?aba=interacoes`}
                className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2 hover:underline"
              >
                <span className="min-w-0">
                  <span className="font-semibold">{c.name}</span>
                  {c.next_contact_note && <span className="text-sm text-muted-foreground"> · {c.next_contact_note}</span>}
                </span>
                {late ? (
                  <StatusBadge tone="danger">Atrasado · {formatDate(c.next_contact_on)}</StatusBadge>
                ) : (
                  <span className="text-sm text-muted-foreground tabular-nums">{formatDate(c.next_contact_on)}</span>
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </Plate>
  )
}

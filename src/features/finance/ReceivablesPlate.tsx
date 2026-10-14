import { Link } from 'react-router-dom'
import { Plate } from '@/components/Plate'
import { StatusBadge } from '@/components/states'
import { formatDate } from '@/lib/format'
import { formatMoney } from '@/lib/money'
import { useReceivables } from './api'
import { paymentKinds } from './schema'
import { sumByCurrency } from './summary'

type Row = {
  id: string
  project_id: string
  kind: string
  description: string | null
  amount_cents: number
  due_date: string
  projects: { name: string; currency: string; clients: { name: string } | null } | null
}

/** "A receber" na Central do dia: parcelas vencidas e as que vencem nos próximos dias. Some quando não há nada. */
export function ReceivablesPlate({ today, endDate, enabled }: { today: string; endDate: string; enabled: boolean }) {
  const q = useReceivables(endDate, enabled)
  const rows = (q.data ?? []) as unknown as Row[]
  if (rows.length === 0) return null

  const totals = [...sumByCurrency(rows.map((r) => ({ currency: r.projects?.currency ?? 'BRL', amount_cents: r.amount_cents })))]
  const overdueCount = rows.filter((r) => r.due_date < today).length

  return (
    <Plate
      id="dash-receivables"
      title="A receber"
      meta={
        <>
          {totals.map(([cur, cents]) => formatMoney(cents, cur)).join(' · ')}
          {overdueCount > 0 && ` · ${overdueCount} em atraso`}
        </>
      }
    >
      <ul>
        {rows.map((r) => {
          const late = r.due_date < today
          const label = r.description || paymentKinds[r.kind as keyof typeof paymentKinds] || r.kind
          return (
            <li key={r.id} className="border-b border-border last:border-b-0">
              <Link
                to={`/app/projetos/${r.project_id}?aba=financeiro`}
                className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2 hover:underline"
              >
                <span className="min-w-0">
                  <span className="font-semibold">{label}</span>
                  <span className="text-sm text-muted-foreground">
                    {' · '}
                    {[r.projects?.name, r.projects?.clients?.name].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  {late ? (
                    <StatusBadge tone="danger">Atrasada · {formatDate(r.due_date)}</StatusBadge>
                  ) : (
                    <span className="text-sm text-muted-foreground tabular-nums">Vence {formatDate(r.due_date)}</span>
                  )}
                  <span className="font-bold tabular-nums">
                    {formatMoney(r.amount_cents, r.projects?.currency ?? 'BRL')}
                  </span>
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </Plate>
  )
}

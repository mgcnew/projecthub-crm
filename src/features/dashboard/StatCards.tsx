import type { ReactNode } from 'react'
import { AlarmClock, CalendarCheck2, MessagesSquare, Wallet, type LucideIcon } from 'lucide-react'
import { IconChip, type Tone } from '@/components/states'
import { formatMinutes } from '@/lib/format'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import { useFollowUpSummary, useReceivablesSummary } from './api'

function Stat({
  label,
  icon,
  tone,
  value,
  note,
  alert = false,
}: {
  label: string
  icon: LucideIcon
  tone: Tone
  /** undefined enquanto carrega. */
  value: ReactNode | undefined
  note?: ReactNode
  alert?: boolean
}) {
  return (
    <div className="plate flex min-w-0 flex-col gap-2 p-3.5 sm:gap-3 sm:p-5">
      <dt className="flex items-start justify-between gap-3 text-[0.8125rem] leading-5 font-medium text-muted-foreground sm:text-sm">
        <span className="pt-1">{label}</span>
        <IconChip icon={icon} tone={tone} className="max-sm:size-7 max-sm:rounded-md" />
      </dt>
      <dd className="min-w-0 space-y-1">
        {value === undefined ? (
          <span aria-label="Carregando" className="block h-8 w-24 animate-pulse rounded-md bg-muted" />
        ) : (
          <span
            className={cn(
              'block truncate text-[1.375rem] leading-8 font-bold tracking-[-0.02em] tabular-nums sm:text-[1.75rem]',
              alert && 'text-destructive',
            )}
          >
            {value}
          </span>
        )}
        <span className="block text-[0.8125rem] leading-snug text-muted-foreground">{note ?? ' '}</span>
      </dd>
    </div>
  )
}

/** Quatro números do dia, todos lidos do banco; nenhuma variação estimada. */
export function StatCards({
  today,
  weekEnd,
  enabled,
  planned,
  overdueCount,
}: {
  today: string
  weekEnd: string
  enabled: boolean
  planned: { total: number; done: number; remainingMinutes: number } | undefined
  overdueCount: number | undefined
}) {
  const receivables = useReceivablesSummary(today, weekEnd, enabled)
  const followUps = useFollowUpSummary(today, weekEnd, enabled)
  const money = receivables.data
  const contacts = followUps.data

  return (
    <dl aria-label="Resumo do dia" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      <Stat
        label="Planejado hoje"
        icon={CalendarCheck2}
        tone="violet"
        value={planned && (planned.total === 0 ? '0' : `${planned.done} de ${planned.total}`)}
        note={
          planned &&
          (planned.total === 0
            ? 'nada planejado'
            : planned.remainingMinutes > 0
              ? `${formatMinutes(planned.remainingMinutes)} restantes`
              : 'concluídas')
        }
      />
      <Stat
        label="Vencidas"
        icon={AlarmClock}
        tone="danger"
        value={overdueCount}
        alert={(overdueCount ?? 0) > 0}
        note={overdueCount === undefined ? undefined : overdueCount === 0 ? 'nenhum prazo passado' : 'tarefas com prazo passado'}
      />
      <Stat
        label="A receber · 7 dias"
        icon={Wallet}
        tone="success"
        value={money && (money.totals.length === 0 ? formatMoney(0) : money.totals.map(([cur, c]) => formatMoney(c, cur)).join(' · '))}
        note={
          money &&
          (money.count === 0
            ? 'nenhuma parcela'
            : money.overdueCount > 0
              ? `${money.overdueCount} parcela${money.overdueCount === 1 ? '' : 's'} em atraso`
              : `${money.count} parcela${money.count === 1 ? '' : 's'}`)
        }
      />
      <Stat
        label="Contatos a fazer"
        icon={MessagesSquare}
        tone="warning"
        value={contacts?.count}
        note={
          contacts &&
          (contacts.count === 0
            ? 'nenhum retorno pendente'
            : contacts.overdueCount > 0
              ? `${contacts.overdueCount} atrasado${contacts.overdueCount === 1 ? '' : 's'}`
              : 'próximos 7 dias')
        }
      />
    </dl>
  )
}

import { Link } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState, StatusBadge } from '@/components/states'
import { formatDate, todayISO } from '@/lib/format'
import { formatMoney } from '@/lib/money'
import { useClientFinance } from './api'
import { SummaryTiles } from './ProjectFinance'
import { summarize } from './summary'

/** Aba "Financeiro" do cliente: resumo por moeda e a situação de cada projeto (gestão no projeto). */
export function ClientFinance({ clientId }: { clientId: string }) {
  const q = useClientFinance(clientId)
  const today = todayISO()

  if (q.isPending) return <LoadingState />
  if (q.isError) return <ErrorState message="Não foi possível carregar o financeiro." onRetry={() => q.refetch()} />

  const { projects, payments } = q.data
  const withValue = projects.filter((p) => p.contract_value_cents !== null || payments.some((x) => x.project_id === p.id))
  if (withValue.length === 0) {
    return (
      <EmptyState
        title="Sem valores ainda"
        description="Defina o valor de um projeto deste cliente (aba Detalhes do projeto) e registre as parcelas na aba Financeiro dele."
      />
    )
  }

  // Uma tabela por moeda: valores de moedas diferentes nunca são somados.
  const currencies = [...new Set(withValue.map((p) => p.currency))]

  return (
    <div className="space-y-6">
      {currencies.map((currency) => {
        const ps = withValue.filter((p) => p.currency === currency)
        const rows = payments.filter((x) => ps.some((p) => p.id === x.project_id))
        const contract = ps.reduce<number | null>(
          (n, p) => (p.contract_value_cents === null ? n : (n ?? 0) + p.contract_value_cents),
          null,
        )
        const summary = summarize(rows, contract, today)
        return (
          <section key={currency} aria-label={`Financeiro em ${currency}`} className="space-y-3">
            <h2 className="section-title">Total em {currency}</h2>
            <SummaryTiles currency={currency} contract={contract} summary={summary} />
            <ul className="plate divide-y divide-border">
              {ps.map((p) => {
                const own = payments.filter((x) => x.project_id === p.id)
                const s = summarize(own, p.contract_value_cents, today)
                return (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 sm:px-5">
                    <div className="min-w-0">
                      <Link to={`/app/projetos/${p.id}?aba=financeiro`} className="font-semibold hover:underline">
                        {p.name}
                      </Link>
                      <p className="text-sm text-muted-foreground tabular-nums">
                        {p.contract_value_cents !== null ? formatMoney(p.contract_value_cents, currency) : 'Sem valor definido'}
                        {' · '}recebido {formatMoney(s.received, currency)}
                        {s.nextDue && <> · próxima {formatDate(s.nextDue)}</>}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {s.overdueCount > 0 && <StatusBadge tone="danger">{s.overdueCount} em atraso</StatusBadge>}
                      {p.archived_at && <StatusBadge>Arquivado</StatusBadge>}
                      <span className="font-bold tabular-nums">{formatMoney(s.pending, currency)} a receber</span>
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

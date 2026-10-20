import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Field } from '@/components/form'
import { controlClass } from '@/components/form-styles'
import { EmptyState, ErrorState, LoadingState, StatusBadge } from '@/components/states'
import { Button } from '@/components/ui/button'
import { useCurrentWorkspace } from '@/features/workspace/useCurrentWorkspace'
import { addDays, formatDate, todayISO } from '@/lib/format'
import { formatMoney, formatMoneyInput, parseMoney } from '@/lib/money'
import { useCreatePayment, useCreatePayments, useDeletePayment, useProjectPayments, useUpdatePayment, type PaymentRow } from './api'
import { PaymentForm } from './PaymentForm'
import { generateSchedule } from './schedule'
import {
  generatorSchema,
  paymentDefaults,
  paymentKinds,
  paymentPayload,
  type GeneratorValues,
  type PaymentFormValues,
} from './schema'
import { summarize } from './summary'
import { DateField } from '@/components/DateTimeField'
import { FormDateField } from '@/components/form-fields'

type ProjectLite = { id: string; name: string; currency: string; contract_value_cents: number | null }

const daysLate = (due: string, today: string) => Math.round((Date.parse(today) - Date.parse(due)) / 86_400_000)

export function SummaryTiles({
  currency,
  contract,
  summary,
}: {
  currency: string
  contract: number | null
  summary: ReturnType<typeof summarize>
}) {
  const tiles: { label: string; value: number; strong?: boolean }[] = [
    { label: 'Valor do projeto', value: contract ?? 0 },
    { label: 'Recebido', value: summary.received },
    { label: 'A receber', value: summary.pending },
    { label: 'Em atraso', value: summary.overdue, strong: summary.overdue > 0 },
  ]
  return (
    <dl className="grid grid-cols-2 gap-px border border-border bg-border lg:grid-cols-4">
      {tiles.map((t) => (
        <div key={t.label} className="bg-card px-4 py-3">
          <dt className="section-title">{t.label}</dt>
          <dd className={'mt-1 text-xl font-bold tabular-nums ' + (t.strong ? 'text-destructive' : '')}>
            {t.label === 'Valor do projeto' && contract === null ? '—' : formatMoney(t.value, currency)}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function PaymentStatus({ p, today }: { p: PaymentRow; today: string }) {
  if (p.status === 'paid') return <StatusBadge tone="success">Recebida em {formatDate(p.paid_on)}</StatusBadge>
  if (p.status === 'cancelled') return <StatusBadge>Cancelada</StatusBadge>
  if (p.due_date < today) {
    const n = daysLate(p.due_date, today)
    return <StatusBadge tone="danger">Atrasada há {n} dia{n === 1 ? '' : 's'}</StatusBadge>
  }
  return <StatusBadge tone="info">{p.due_date === today ? 'Vence hoje' : 'A receber'}</StatusBadge>
}

function PaymentItem({ p, currency, canWrite, today }: { p: PaymentRow; currency: string; canWrite: boolean; today: string }) {
  const update = useUpdatePayment()
  const remove = useDeletePayment()
  const [mode, setMode] = useState<'view' | 'edit' | 'receive'>('view')
  const [paidOn, setPaidOn] = useState(today)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const label = p.description || paymentKinds[p.kind as keyof typeof paymentKinds] || p.kind

  const patch = async (data: Parameters<typeof update.mutateAsync>[0]['patch']) => {
    setError(null)
    try {
      await update.mutateAsync({ id: p.id, patch: data })
      setMode('view')
    } catch {
      setError('Não foi possível salvar. Tente novamente.')
    }
  }

  if (mode === 'edit') {
    return (
      <li className="p-3">
        <PaymentForm
          currency={currency}
          submitLabel="Salvar parcela"
          serverError={error}
          initial={{
            kind: p.kind as PaymentFormValues['kind'],
            description: p.description ?? '',
            amount: formatMoneyInput(p.amount_cents),
            due_date: p.due_date,
            payment_method: p.payment_method ?? '',
            invoice_number: p.invoice_number ?? '',
            notes: p.notes ?? '',
          }}
          onCancel={() => setMode('view')}
          onSubmit={async (values) => patch(paymentPayload(values))}
        />
      </li>
    )
  }

  return (
    <li className="space-y-2 px-4 py-3 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <p className="font-semibold">{label}</p>
          <p className="text-sm text-muted-foreground">
            <span className="tabular-nums">Vence em {formatDate(p.due_date)}</span>
            {p.payment_method && <> · {p.payment_method}</>}
            {p.invoice_number && <> · Nota {p.invoice_number}</>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <PaymentStatus p={p} today={today} />
          <span className="text-lg font-bold tabular-nums">{formatMoney(p.amount_cents, currency)}</span>
        </div>
      </div>

      {canWrite && mode === 'view' && (
        <div className="flex flex-wrap gap-2">
          {p.status === 'pending' && (
            <Button size="sm" onClick={() => setMode('receive')}>
              Marcar como recebida
            </Button>
          )}
          {p.status === 'paid' && (
            <Button size="sm" variant="outline" onClick={() => patch({ status: 'pending', paid_on: null })}>
              Voltar para a receber
            </Button>
          )}
          {p.status === 'cancelled' && (
            <Button size="sm" variant="outline" onClick={() => patch({ status: 'pending' })}>
              Reativar
            </Button>
          )}
          {p.status === 'pending' && (
            <Button size="sm" variant="outline" onClick={() => patch({ status: 'cancelled' })}>
              Cancelar parcela
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setMode('edit')}>
            Editar
          </Button>
          {p.status !== 'paid' && (
            <Button size="sm" variant="outline" onClick={() => setConfirmDelete(true)}>
              Excluir
            </Button>
          )}
        </div>
      )}

      {mode === 'receive' && (
        <form
          className="flex flex-wrap items-end gap-3 border-t border-border pt-3"
          onSubmit={(e) => {
            e.preventDefault()
            void patch({ status: 'paid', paid_on: paidOn })
          }}
        >
          <div className="space-y-1.5">
            <label htmlFor={`paid-${p.id}`} className="text-sm font-medium">
              Recebida em
            </label>
            <DateField id={`paid-${p.id}`} value={paidOn} onChange={setPaidOn} clearable={false} />
          </div>
          <Button type="submit" disabled={!paidOn || update.isPending}>
            Confirmar recebimento
          </Button>
          <Button type="button" variant="outline" onClick={() => setMode('view')}>
            Cancelar
          </Button>
        </form>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Excluir esta parcela?"
        description="A parcela é removida de vez e não há como desfazer. Para manter o histórico, prefira cancelá-la."
        confirmLabel="Excluir parcela"
        pending={remove.isPending}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          try {
            await remove.mutateAsync(p.id)
          } catch {
            setError('Não foi possível excluir a parcela.')
          } finally {
            setConfirmDelete(false)
          }
        }}
      />
    </li>
  )
}

function Generator({
  project,
  onDone,
  onCancel,
}: {
  project: ProjectLite
  onDone: () => void
  onCancel: () => void
}) {
  const { orgId } = useCurrentWorkspace()
  const create = useCreatePayments(orgId, project.id)
  const today = todayISO()
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<GeneratorValues>({
    resolver: zodResolver(generatorSchema),
    defaultValues: {
      total: formatMoneyInput(project.contract_value_cents),
      advance_percent: '30',
      installments: '3',
      advance_due: today,
      first_due: addDays(today, 30),
    },
  })

  const submit = handleSubmit(async (v) => {
    setError(null)
    const plan = generateSchedule({
      totalCents: parseMoney(v.total) ?? 0,
      advancePercent: v.advance_percent === '' ? 0 : Number(v.advance_percent),
      installments: Number(v.installments),
      advanceDue: v.advance_due,
      firstDue: v.first_due,
    })
    if (plan.length === 0) {
      setError('Não foi possível gerar as parcelas com esses valores.')
      return
    }
    try {
      await create.mutateAsync(plan)
      onDone()
    } catch {
      setError('Não foi possível criar as parcelas. Tente novamente.')
    }
  })

  return (
    <form onSubmit={submit} noValidate className="plate space-y-4 p-4">
      <h3 className="section-title">Gerar parcelas</h3>
      <p className="text-sm text-muted-foreground">
        Cria um adiantamento (opcional) e parcelas mensais do restante. A soma fecha exatamente no valor total, e
        você pode ajustar cada parcela depois.
      </p>
      <fieldset disabled={isSubmitting} className="grid gap-4 sm:grid-cols-2">
        <Field id="gen-total" label={`Valor total (${project.currency}) *`} error={errors.total?.message}>
          <input id="gen-total" inputMode="decimal" autoComplete="off" className={controlClass} {...register('total')} />
        </Field>
        <Field id="gen-pct" label="Adiantamento (%)" error={errors.advance_percent?.message} hint="0 para não ter adiantamento">
          <input id="gen-pct" inputMode="numeric" autoComplete="off" className={controlClass} {...register('advance_percent')} />
        </Field>
        <Field id="gen-adv-due" label="Vencimento do adiantamento *" error={errors.advance_due?.message}>
          <FormDateField id="gen-adv-due" control={control} name="advance_due" clearable={false} />
        </Field>
        <Field id="gen-n" label="Número de parcelas *" error={errors.installments?.message}>
          <input id="gen-n" inputMode="numeric" autoComplete="off" className={controlClass} {...register('installments')} />
        </Field>
        <Field id="gen-first" label="Vencimento da 1ª parcela *" error={errors.first_due?.message} hint="As demais seguem mês a mês">
          <FormDateField id="gen-first" control={control} name="first_due" clearable={false} />
        </Field>
      </fieldset>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Gerando…' : 'Gerar parcelas'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}

/** Aba "Financeiro" do projeto: valor, parcelas (adiantamento, parcelas, saldo), vencimentos e situação. */
export function ProjectFinance({ project }: { project: ProjectLite }) {
  const { orgId, canWrite } = useCurrentWorkspace()
  const q = useProjectPayments(project.id)
  const create = useCreatePayment(orgId, project.id)
  const [mode, setMode] = useState<'none' | 'new' | 'generate'>('none')
  const [error, setError] = useState<string | null>(null)
  const today = todayISO()

  if (q.isPending) return <LoadingState />
  if (q.isError) return <ErrorState message="Não foi possível carregar o financeiro." onRetry={() => q.refetch()} />

  const payments = q.data
  const summary = summarize(payments, project.contract_value_cents, today)

  return (
    <section aria-labelledby="fin-h" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="fin-h" className="section-title">
          Financeiro · {project.currency}
        </h2>
        {canWrite && mode === 'none' && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setMode('generate')}>
              Gerar parcelas
            </Button>
            <Button onClick={() => setMode('new')}>Nova parcela</Button>
          </div>
        )}
      </div>

      <SummaryTiles currency={project.currency} contract={project.contract_value_cents} summary={summary} />

      {summary.gap !== null && summary.gap !== 0 && payments.length > 0 && (
        <p role="status" className="rounded-lg bg-tone-info-bg px-3 py-2 text-sm font-medium text-tone-info">
          {summary.gap > 0
            ? `Faltam ${formatMoney(summary.gap, project.currency)} para programar: as parcelas somam menos que o valor do projeto.`
            : `As parcelas passam ${formatMoney(-summary.gap, project.currency)} do valor do projeto.`}
        </p>
      )}
      {project.contract_value_cents === null && (
        <p className="text-sm text-muted-foreground">
          Defina o <strong>valor do projeto</strong> na aba Detalhes para comparar com as parcelas.
        </p>
      )}

      {mode === 'new' && (
        <PaymentForm
          currency={project.currency}
          submitLabel="Adicionar parcela"
          serverError={error}
          initial={paymentDefaults(today)}
          onCancel={() => setMode('none')}
          onSubmit={async (values) => {
            setError(null)
            try {
              await create.mutateAsync(values)
              setMode('none')
            } catch {
              setError('Não foi possível salvar a parcela. Tente novamente.')
            }
          }}
        />
      )}
      {mode === 'generate' && (
        <Generator project={project} onDone={() => setMode('none')} onCancel={() => setMode('none')} />
      )}

      {payments.length === 0 && mode === 'none' && (
        <EmptyState
          title="Nenhuma parcela"
          description="Registre o adiantamento e as parcelas com vencimento, ou gere tudo de uma vez."
        />
      )}
      {payments.length > 0 && (
        <ul className="plate divide-y divide-border">
          {payments.map((p) => (
            <PaymentItem key={p.id} p={p} currency={project.currency} canWrite={canWrite} today={today} />
          ))}
        </ul>
      )}
    </section>
  )
}

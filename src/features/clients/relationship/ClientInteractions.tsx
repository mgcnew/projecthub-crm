import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Field } from '@/components/form'
import { controlClass, textareaClass } from '@/components/form-styles'
import { EmptyState, ErrorState, LoadingState, StatusBadge } from '@/components/states'
import { Button } from '@/components/ui/button'
import { useCurrentWorkspace } from '@/features/workspace/useCurrentWorkspace'
import { formatDate, formatDateTime, toLocalInput, todayISO } from '@/lib/format'
import { useClientContacts } from '../contacts/api'
import {
  useDeleteInteraction,
  useInteractions,
  useSaveInteraction,
  useSaveNextContact,
  type InteractionRow,
} from './api'
import {
  interactionFormSchema,
  interactionKinds,
  nextContactSchema,
  type InteractionFormValues,
  type NextContactValues,
} from './schema'
import { FormDateField, FormDateTimeField } from '@/components/form-fields'

function NextContact({ clientId, date, note, canWrite }: { clientId: string; date: string | null; note: string | null; canWrite: boolean }) {
  const save = useSaveNextContact(clientId)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const today = todayISO()
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<NextContactValues>({
    resolver: zodResolver(nextContactSchema),
    defaultValues: { next_contact_on: date ?? '', next_contact_note: note ?? '' },
  })

  const submit = handleSubmit(async (v) => {
    setError(null)
    try {
      await save.mutateAsync(v)
      setEditing(false)
    } catch {
      setError('Não foi possível salvar.')
    }
  })

  const late = date !== null && date < today

  return (
    <section aria-labelledby="next-h" className="plate space-y-3 p-4">
      <h2 id="next-h" className="section-title">
        Próximo contato
      </h2>
      {!editing ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {date ? (
            <p className="flex flex-wrap items-center gap-2">
              <span className="font-bold tabular-nums">{formatDate(date)}</span>
              {late && <StatusBadge tone="danger">Atrasado</StatusBadge>}
              {note && <span className="text-sm text-muted-foreground">{note}</span>}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum contato agendado.</p>
          )}
          {canWrite && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                {date ? 'Alterar' : 'Agendar'}
              </Button>
              {date && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={save.isPending}
                  onClick={() => void save.mutateAsync({ next_contact_on: '', next_contact_note: '' })}
                >
                  Limpar
                </Button>
              )}
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-3">
          <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
            <Field id="next-date" label="Data *" error={errors.next_contact_on?.message}>
              <FormDateField id="next-date" control={control} name="next_contact_on" />
            </Field>
            <Field id="next-note" label="O que fazer" error={errors.next_contact_note?.message} hint="Ex.: cobrar retorno da proposta">
              <input id="next-note" autoComplete="off" className={controlClass} {...register('next_contact_note')} />
            </Field>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={isSubmitting}>
              Salvar
            </Button>
            <Button type="button" variant="outline" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      )}
    </section>
  )
}

function InteractionForm({
  clientId,
  initial,
  submitLabel,
  serverError,
  onSubmit,
  onCancel,
}: {
  clientId: string
  initial: InteractionFormValues
  submitLabel: string
  serverError: string | null
  onSubmit: (v: InteractionFormValues) => Promise<void>
  onCancel: () => void
}) {
  const contacts = useClientContacts(clientId)
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<InteractionFormValues>({ resolver: zodResolver(interactionFormSchema), defaultValues: initial })
  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="plate space-y-4 p-4">
      <fieldset disabled={isSubmitting} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="int-kind" label="Tipo">
            <select id="int-kind" className={controlClass} {...register('kind')}>
              {Object.entries(interactionKinds).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field id="int-when" label="Quando *" error={errors.occurred_at?.message}>
            <FormDateTimeField id="int-when" control={control} name="occurred_at" clearable={false} />
          </Field>
          <Field id="int-contact" label="Com quem">
            <select id="int-contact" className={controlClass} {...register('contact_id')}>
              <option value="">Sem contato específico</option>
              {(contacts.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field id="int-summary" label="O que foi tratado *" error={errors.summary?.message}>
          <textarea id="int-summary" className={textareaClass} {...register('summary')} />
        </Field>
      </fieldset>
      {serverError && (
        <p role="alert" className="text-sm text-destructive">
          {serverError}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Salvando…' : submitLabel}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}

/** Aba "Interações": próximo contato e a linha do tempo de ligações, e-mails, reuniões e anotações. */
export function ClientInteractions({
  clientId,
  nextContactOn,
  nextContactNote,
}: {
  clientId: string
  nextContactOn: string | null
  nextContactNote: string | null
}) {
  const { orgId, canWrite } = useCurrentWorkspace()
  const q = useInteractions(clientId)
  const save = useSaveInteraction(orgId, clientId)
  const remove = useDeleteInteraction(clientId)
  const [editing, setEditing] = useState<'new' | string | null>(null)
  const [toDelete, setToDelete] = useState<InteractionRow | null>(null)
  const [error, setError] = useState<string | null>(null)

  const current = (q.data ?? []).find((i) => i.id === editing)

  const submit = async (values: InteractionFormValues) => {
    setError(null)
    try {
      await save.mutateAsync({ id: editing && editing !== 'new' ? editing : undefined, values })
      setEditing(null)
    } catch {
      setError('Não foi possível salvar. Tente novamente.')
    }
  }

  return (
    <div className="space-y-4">
      <NextContact clientId={clientId} date={nextContactOn} note={nextContactNote} canWrite={canWrite} />

      <section aria-labelledby="int-h" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="int-h" className="section-title">
            Interações
          </h2>
          {canWrite && editing === null && <Button onClick={() => setEditing('new')}>Registrar interação</Button>}
        </div>

        {editing === 'new' && (
          <InteractionForm
            clientId={clientId}
            initial={{ kind: 'call', occurred_at: toLocalInput(new Date().toISOString()), contact_id: '', summary: '' }}
            submitLabel="Registrar"
            serverError={error}
            onSubmit={submit}
            onCancel={() => setEditing(null)}
          />
        )}
        {current && (
          <InteractionForm
            key={current.id}
            clientId={clientId}
            initial={{
              kind: current.kind as InteractionFormValues['kind'],
              occurred_at: toLocalInput(current.occurred_at),
              contact_id: current.contact_id ?? '',
              summary: current.summary,
            }}
            submitLabel="Salvar"
            serverError={error}
            onSubmit={submit}
            onCancel={() => setEditing(null)}
          />
        )}

        {q.isPending && <LoadingState />}
        {q.isError && <ErrorState message="Não foi possível carregar as interações." onRetry={() => q.refetch()} />}
        {q.isSuccess && q.data.length === 0 && editing === null && (
          <EmptyState title="Nenhuma interação" description="Registre ligações, e-mails e combinados para não perder o fio." />
        )}
        {q.isSuccess && q.data.length > 0 && (
          <ol className="plate divide-y divide-border">
            {q.data.map((i) => (
              <li key={i.id} className="space-y-1 px-4 py-3 sm:px-5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <StatusBadge>{interactionKinds[i.kind as keyof typeof interactionKinds] ?? i.kind}</StatusBadge>
                  <span className="text-sm font-semibold tabular-nums">{formatDateTime(i.occurred_at)}</span>
                  {i.client_contacts && <span className="text-sm text-muted-foreground">com {i.client_contacts.name}</span>}
                </div>
                <p className="whitespace-pre-wrap">{i.summary}</p>
                {canWrite && editing === null && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button size="sm" variant="outline" onClick={() => setEditing(i.id)}>
                      Editar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setToDelete(i)}>
                      Excluir
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      <ConfirmDialog
        open={toDelete !== null}
        title="Excluir esta interação?"
        description="O registro é removido de vez e não há como desfazer."
        confirmLabel="Excluir interação"
        pending={remove.isPending}
        onCancel={() => setToDelete(null)}
        onConfirm={async () => {
          if (!toDelete) return
          try {
            await remove.mutateAsync(toDelete.id)
          } catch {
            setError('Não foi possível excluir.')
          } finally {
            setToDelete(null)
          }
        }}
      />
    </div>
  )
}

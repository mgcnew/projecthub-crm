import { zodResolver } from '@hookform/resolvers/zod'
import { Mail, MessageCircle, Phone } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { CopyButton } from '@/components/CopyButton'
import { Field } from '@/components/form'
import { controlClass, textareaClass } from '@/components/form-styles'
import { EmptyState, ErrorState, LoadingState, StatusBadge } from '@/components/states'
import { Button } from '@/components/ui/button'
import { useCurrentWorkspace } from '@/features/workspace/useCurrentWorkspace'
import { telUrl, whatsappUrl } from '@/lib/documents'
import { useClientContacts, useDeleteContact, useSaveContact, type ContactRow } from './api'
import { contactDefaults, contactFormSchema, type ContactFormValues } from './schema'

const linkClass =
  'inline-flex min-h-11 items-center gap-1.5 rounded-sm border border-input bg-card px-2.5 text-sm font-semibold hover:bg-muted'

function ContactForm({
  initial,
  submitLabel,
  serverError,
  onSubmit,
  onCancel,
}: {
  initial: ContactFormValues
  submitLabel: string
  serverError: string | null
  onSubmit: (v: ContactFormValues) => Promise<void>
  onCancel: () => void
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormValues>({ resolver: zodResolver(contactFormSchema), defaultValues: initial })
  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="plate space-y-4 p-4">
      <fieldset disabled={isSubmitting} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="ct-name" label="Nome *" error={errors.name?.message}>
            <input id="ct-name" autoComplete="off" className={controlClass} aria-invalid={errors.name ? true : undefined} {...register('name')} />
          </Field>
          <Field id="ct-role" label="Cargo" error={errors.role_title?.message}>
            <input id="ct-role" autoComplete="off" className={controlClass} {...register('role_title')} />
          </Field>
          <Field id="ct-email" label="E-mail" error={errors.email?.message}>
            <input id="ct-email" type="email" autoComplete="off" className={controlClass} {...register('email')} />
          </Field>
          <Field id="ct-phone" label="Telefone" error={errors.phone?.message}>
            <input id="ct-phone" type="tel" autoComplete="off" className={controlClass} {...register('phone')} />
          </Field>
          <Field id="ct-wa" label="WhatsApp" error={errors.whatsapp?.message} hint="Com DDD. Ex.: (11) 91234-5678">
            <input id="ct-wa" type="tel" autoComplete="off" className={controlClass} {...register('whatsapp')} />
          </Field>
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
          <input type="checkbox" className="size-5" {...register('is_primary')} />
          Contato principal deste cliente
        </label>
        <Field id="ct-notes" label="Observações" error={errors.notes?.message}>
          <textarea id="ct-notes" className={textareaClass} {...register('notes')} />
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

function ContactItem({ c, canWrite, onEdit, onDelete }: { c: ContactRow; canWrite: boolean; onEdit: () => void; onDelete: () => void }) {
  const wa = c.whatsapp ? whatsappUrl(c.whatsapp) : null
  const tel = c.phone ? telUrl(c.phone) : null
  return (
    <li className="space-y-2 px-4 py-3 sm:px-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="font-semibold">{c.name}</p>
        {c.role_title && <span className="text-sm text-muted-foreground">{c.role_title}</span>}
        {c.is_primary && <StatusBadge tone="info">Principal</StatusBadge>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {c.email && (
          <>
            <a href={`mailto:${c.email}`} aria-label={`Enviar e-mail para ${c.name}`} className={linkClass}>
              <Mail aria-hidden="true" className="size-4" />
              {c.email}
            </a>
            <CopyButton text={c.email} label={`Copiar o e-mail de ${c.name}`} />
          </>
        )}
        {c.phone && (
          <>
            {tel ? (
              <a href={tel} aria-label={`Ligar para ${c.name}`} className={linkClass}>
                <Phone aria-hidden="true" className="size-4" />
                {c.phone}
              </a>
            ) : (
              <span className="text-sm">{c.phone}</span>
            )}
            <CopyButton text={c.phone} label={`Copiar o telefone de ${c.name}`} />
          </>
        )}
        {wa && (
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Abrir o WhatsApp de ${c.name} em nova aba`}
            className={linkClass}
          >
            <MessageCircle aria-hidden="true" className="size-4" />
            WhatsApp
          </a>
        )}
      </div>
      {c.notes && <p className="text-sm text-muted-foreground">{c.notes}</p>}
      {canWrite && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={onEdit}>
            Editar
          </Button>
          <Button size="sm" variant="outline" onClick={onDelete}>
            Excluir
          </Button>
        </div>
      )}
    </li>
  )
}

/** Aba "Contatos" do cliente: várias pessoas, uma principal, com e-mail, ligação e WhatsApp a um clique. */
export function ClientContacts({ clientId }: { clientId: string }) {
  const { orgId, canWrite } = useCurrentWorkspace()
  const q = useClientContacts(clientId)
  const save = useSaveContact(orgId, clientId)
  const remove = useDeleteContact(clientId)
  const [editing, setEditing] = useState<'new' | string | null>(null)
  const [toDelete, setToDelete] = useState<ContactRow | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (q.isPending) return <LoadingState />
  if (q.isError) return <ErrorState message="Não foi possível carregar os contatos." onRetry={() => q.refetch()} />
  const contacts = q.data
  const current = contacts.find((c) => c.id === editing)

  const submit = async (values: ContactFormValues) => {
    setError(null)
    try {
      await save.mutateAsync({ id: editing && editing !== 'new' ? editing : undefined, values })
      setEditing(null)
    } catch {
      setError('Não foi possível salvar o contato. Tente novamente.')
    }
  }

  return (
    <section aria-labelledby="contacts-h" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="contacts-h" className="section-title">
          Contatos
        </h2>
        {canWrite && editing === null && <Button onClick={() => setEditing('new')}>Novo contato</Button>}
      </div>

      {editing === 'new' && (
        <ContactForm
          initial={{ ...contactDefaults, is_primary: contacts.length === 0 }}
          submitLabel="Adicionar contato"
          serverError={error}
          onSubmit={submit}
          onCancel={() => setEditing(null)}
        />
      )}
      {current && (
        <ContactForm
          key={current.id}
          initial={{
            name: current.name,
            role_title: current.role_title ?? '',
            email: current.email ?? '',
            phone: current.phone ?? '',
            whatsapp: current.whatsapp ?? '',
            is_primary: current.is_primary,
            notes: current.notes ?? '',
          }}
          submitLabel="Salvar contato"
          serverError={error}
          onSubmit={submit}
          onCancel={() => setEditing(null)}
        />
      )}

      {contacts.length === 0 && editing === null && (
        <EmptyState title="Nenhum contato" description="Cadastre quem fala por este cliente: nome, cargo, e-mail e WhatsApp." />
      )}
      {contacts.length > 0 && (
        <ul className="plate divide-y divide-border">
          {contacts.map((c) => (
            <ContactItem key={c.id} c={c} canWrite={canWrite} onEdit={() => setEditing(c.id)} onDelete={() => setToDelete(c)} />
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        title={`Excluir “${toDelete?.name ?? ''}”?`}
        description="O contato é removido de vez deste cliente. Isso não apaga nada fora do sistema."
        confirmLabel="Excluir contato"
        pending={remove.isPending}
        onCancel={() => setToDelete(null)}
        onConfirm={async () => {
          if (!toDelete) return
          try {
            await remove.mutateAsync(toDelete.id)
          } catch {
            setError('Não foi possível excluir o contato.')
          } finally {
            setToDelete(null)
          }
        }}
      />
    </section>
  )
}

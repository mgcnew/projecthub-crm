import { zodResolver } from '@hookform/resolvers/zod'
import { ExternalLink } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { CopyButton } from '@/components/CopyButton'
import { Field } from '@/components/form'
import { controlClass, textareaClass } from '@/components/form-styles'
import { EmptyState, ErrorState, LoadingState, StatusBadge } from '@/components/states'
import { Button } from '@/components/ui/button'
import { useProjectsByClient } from '@/features/projects/api'
import { useCurrentWorkspace } from '@/features/workspace/useCurrentWorkspace'
import { useDeleteDocument, useDocuments, useSaveDocument, type DocumentRow } from './api'
import {
  documentDefaults,
  documentFormSchema,
  documentKinds,
  type DocumentFormValues,
} from './schema'

function DocumentForm({
  clientId,
  initial,
  submitLabel,
  serverError,
  onSubmit,
  onCancel,
}: {
  clientId: string
  initial: DocumentFormValues
  submitLabel: string
  serverError: string | null
  onSubmit: (v: DocumentFormValues) => Promise<void>
  onCancel: () => void
}) {
  const projects = useProjectsByClient(clientId)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DocumentFormValues>({ resolver: zodResolver(documentFormSchema), defaultValues: initial })
  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="plate space-y-4 p-4">
      <fieldset disabled={isSubmitting} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="doc-title" label="Título *" error={errors.title?.message}>
            <input id="doc-title" autoComplete="off" className={controlClass} {...register('title')} />
          </Field>
          <Field id="doc-kind" label="Tipo">
            <select id="doc-kind" className={controlClass} {...register('kind')}>
              {Object.entries(documentKinds).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field id="doc-url" label="Endereço do documento *" error={errors.url?.message} hint="Link do Drive, Notion, etc. (https://)">
          <input id="doc-url" type="url" inputMode="url" autoComplete="off" className={controlClass} {...register('url')} />
        </Field>
        <Field id="doc-project" label="Projeto">
          <select id="doc-project" className={controlClass} {...register('project_id')}>
            <option value="">Do cliente (sem projeto)</option>
            {(projects.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field id="doc-notes" label="Observações" error={errors.notes?.message}>
          <textarea id="doc-notes" className={textareaClass} {...register('notes')} />
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

/** Aba "Documentos": links para contrato, proposta, briefing e notas; sem envio de arquivos. */
export function ClientDocuments({ clientId }: { clientId: string }) {
  const { orgId, canWrite } = useCurrentWorkspace()
  const q = useDocuments(clientId)
  const save = useSaveDocument(orgId, clientId)
  const remove = useDeleteDocument(clientId)
  const [editing, setEditing] = useState<'new' | string | null>(null)
  const [toDelete, setToDelete] = useState<DocumentRow | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (q.isPending) return <LoadingState />
  if (q.isError) return <ErrorState message="Não foi possível carregar os documentos." onRetry={() => q.refetch()} />
  const docs = q.data
  const current = docs.find((d) => d.id === editing)

  const submit = async (values: DocumentFormValues) => {
    setError(null)
    try {
      await save.mutateAsync({ id: editing && editing !== 'new' ? editing : undefined, values })
      setEditing(null)
    } catch {
      setError('Não foi possível salvar o documento. Tente novamente.')
    }
  }

  return (
    <section aria-labelledby="docs-h" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="docs-h" className="section-title">
          Documentos
        </h2>
        {canWrite && editing === null && <Button onClick={() => setEditing('new')}>Novo documento</Button>}
      </div>

      {editing === 'new' && (
        <DocumentForm
          clientId={clientId}
          initial={documentDefaults}
          submitLabel="Adicionar documento"
          serverError={error}
          onSubmit={submit}
          onCancel={() => setEditing(null)}
        />
      )}
      {current && (
        <DocumentForm
          key={current.id}
          clientId={clientId}
          initial={{
            title: current.title,
            url: current.url,
            kind: current.kind as DocumentFormValues['kind'],
            project_id: current.project_id ?? '',
            notes: current.notes ?? '',
          }}
          submitLabel="Salvar documento"
          serverError={error}
          onSubmit={submit}
          onCancel={() => setEditing(null)}
        />
      )}

      {docs.length === 0 && editing === null && (
        <EmptyState
          title="Nenhum documento"
          description="Guarde o link do contrato, da proposta e do briefing. Os arquivos ficam onde já estão."
        />
      )}
      {docs.length > 0 && (
        <ul className="plate divide-y divide-border">
          {docs.map((d) => (
            <li key={d.id} className="space-y-2 px-4 py-3 sm:px-5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <p className="font-semibold">{d.title}</p>
                <StatusBadge>{documentKinds[d.kind as keyof typeof documentKinds] ?? d.kind}</StatusBadge>
                {d.projects && <span className="text-sm text-muted-foreground">{d.projects.name}</span>}
              </div>
              {d.notes && <p className="text-sm text-muted-foreground">{d.notes}</p>}
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={d.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Abrir ${d.title} em nova aba`}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-border-strong bg-card px-2.5 text-sm font-semibold hover:bg-muted"
                >
                  <ExternalLink aria-hidden="true" className="size-4" />
                  Abrir
                </a>
                <CopyButton text={d.url} label={`Copiar o link de ${d.title}`} />
                {canWrite && editing === null && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => setEditing(d.id)}>
                      Editar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setToDelete(d)}>
                      Excluir
                    </Button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        title={`Excluir “${toDelete?.title ?? ''}”?`}
        description="Só o link é removido daqui. O documento em si continua onde está guardado."
        confirmLabel="Excluir documento"
        pending={remove.isPending}
        onCancel={() => setToDelete(null)}
        onConfirm={async () => {
          if (!toDelete) return
          try {
            await remove.mutateAsync(toDelete.id)
          } catch {
            setError('Não foi possível excluir o documento.')
          } finally {
            setToDelete(null)
          }
        }}
      />
    </section>
  )
}

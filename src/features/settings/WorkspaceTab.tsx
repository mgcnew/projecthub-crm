import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Field } from '@/components/form'
import { controlClass } from '@/components/form-styles'
import { Plate } from '@/components/Plate'
import { StatusBadge } from '@/components/states'
import { Button } from '@/components/ui/button'
import { useCurrentWorkspace } from '@/features/workspace/useCurrentWorkspace'
import { useRenameWorkspace } from './api'
import { roleLabels, workspaceSchema, type WorkspaceValues } from './schema'

/** Nome do espaço de trabalho (organização). Só o proprietário edita; o banco confere (RLS). */
export function WorkspaceTab() {
  const { workspace, canWrite, isPending, isError } = useCurrentWorkspace()
  const rename = useRenameWorkspace()
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<WorkspaceValues>({ resolver: zodResolver(workspaceSchema), values: { name: workspace?.name ?? '' } })

  const submit = handleSubmit(async ({ name }) => {
    if (!workspace) return
    setMessage(null)
    setError(null)
    try {
      await rename.mutateAsync({ id: workspace.id, name })
      setMessage('Nome do espaço salvo.')
    } catch {
      setError('Não foi possível salvar o nome do espaço.')
    }
  })

  return (
    <Plate
      id="ws-h"
      title="Espaço de trabalho"
      action={workspace && <StatusBadge tone={canWrite ? 'info' : 'neutral'}>{roleLabels[workspace.role] ?? workspace.role}</StatusBadge>}
    >
      <div className="max-w-xl space-y-4">
        {isPending && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {isError && (
          <p role="alert" className="text-sm text-destructive">
            Não foi possível carregar o espaço de trabalho.
          </p>
        )}
        {workspace && (
          <form onSubmit={submit} noValidate className="space-y-4">
            <Field
              id="workspace-name"
              label="Nome do espaço"
              error={errors.name?.message}
              hint={canWrite ? 'Aparece na Central do dia.' : 'Só o proprietário pode alterar o nome.'}
            >
              <input
                id="workspace-name"
                className={controlClass}
                disabled={!canWrite}
                aria-invalid={errors.name ? true : undefined}
                aria-describedby={errors.name ? 'workspace-name-error' : undefined}
                {...register('name')}
              />
            </Field>
            {canWrite && (
              <Button type="submit" disabled={rename.isPending || !isDirty}>
                {rename.isPending ? 'Salvando…' : 'Salvar nome'}
              </Button>
            )}
            {message && (
              <p role="status" className="text-sm text-tone-success">
                {message}
              </p>
            )}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </form>
        )}
      </div>
    </Plate>
  )
}

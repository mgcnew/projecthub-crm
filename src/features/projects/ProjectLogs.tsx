import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/form'
import { controlClass, textareaClass } from '@/components/form-styles'
import { ErrorState, LoadingState } from '@/components/states'
import { useAuth } from '@/features/auth/auth-context'
import { useCurrentWorkspace } from '@/features/workspace/useCurrentWorkspace'
import { formatDateTime } from '@/lib/format'
import { useAddProjectLog, useProjectLogs } from './api'
import { logSchema, type LogValues } from './schema'

export function ProjectLogs({ projectId }: { projectId: string }) {
  const { session } = useAuth()
  const { orgId, canWrite } = useCurrentWorkspace()
  const logs = useProjectLogs(projectId)
  const add = useAddProjectLog(orgId, projectId, session?.user.id)
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LogValues>({ resolver: zodResolver(logSchema), defaultValues: { title: '', content: '' } })

  const submit = handleSubmit(async (values) => {
    setError(null)
    try {
      await add.mutateAsync(values)
      reset()
    } catch {
      setError('Não foi possível registrar a anotação.')
    }
  })

  return (
    <section aria-labelledby="project-history" className="space-y-4">
      <h2 id="project-history" className="section-title">
        Histórico
      </h2>

      {canWrite && (
        <form onSubmit={submit} noValidate className="space-y-3 rounded-md border border-border bg-card p-4">
          <Field id="log-title" label="Título" error={errors.title?.message}>
            <input id="log-title" className={controlClass} aria-invalid={errors.title ? true : undefined} {...register('title')} />
          </Field>
          <Field id="log-content" label="Anotação" error={errors.content?.message}>
            <textarea id="log-content" className={textareaClass} {...register('content')} />
          </Field>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Registrando…' : 'Registrar'}
          </Button>
        </form>
      )}

      {logs.isPending && <LoadingState />}
      {logs.isError && <ErrorState message="Não foi possível carregar o histórico." onRetry={() => logs.refetch()} />}
      {logs.isSuccess && logs.data.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhuma anotação ainda.</p>
      )}
      {logs.isSuccess && logs.data.length > 0 && (
        <ol className="space-y-3">
          {logs.data.map((l) => (
            <li key={l.id} className="rounded-md border border-border bg-card p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium">{l.title}</p>
                <time dateTime={l.created_at} className="text-xs text-muted-foreground">
                  {formatDateTime(l.created_at)}
                </time>
              </div>
              {l.content && <p className="mt-2 whitespace-pre-wrap text-sm">{l.content}</p>}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

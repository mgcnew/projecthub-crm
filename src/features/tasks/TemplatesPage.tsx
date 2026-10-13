import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Field } from '@/components/form'
import { controlClass, textareaClass } from '@/components/form-styles'
import { EmptyState, ErrorState, LoadingState, PageHeader } from '@/components/states'
import { useCurrentWorkspace } from '@/features/workspace/useCurrentWorkspace'
import { useChecklistTemplates, useCreateTemplate, useDeleteTemplate } from './api'

export function TemplatesPage() {
  const { orgId, canWrite } = useCurrentWorkspace()
  const templates = useChecklistTemplates(Boolean(orgId))
  const create = useCreateTemplate(orgId)
  const del = useDeleteTemplate()
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [items, setItems] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(null)

  const parsed = items.split('\n').map((l) => l.trim()).filter(Boolean)

  return (
    <>
      <PageHeader
        title="Modelos de checklist"
        description="Aplicar um modelo copia os itens para a tarefa; alterar o modelo depois não muda checklists já criados."
        actions={
          <Button asChild variant="outline">
            <Link to="/app/tarefas">Voltar às tarefas</Link>
          </Button>
        }
      />

      {canWrite && (
        <form
          noValidate
          className="space-y-3 rounded-md border border-border bg-card p-4"
          onSubmit={async (e) => {
            e.preventDefault()
            setError(null)
            if (!name.trim()) return setError('Informe o nome do modelo.')
            if (parsed.length === 0) return setError('Informe ao menos um item.')
            try {
              await create.mutateAsync({ name, category, items: parsed })
              setName('')
              setCategory('')
              setItems('')
            } catch {
              setError('Não foi possível criar o modelo.')
            }
          }}
        >
          <Field id="tpl-name" label="Nome *">
            <input id="tpl-name" className={controlClass} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field id="tpl-category" label="Categoria">
            <input id="tpl-category" className={controlClass} value={category} onChange={(e) => setCategory(e.target.value)} />
          </Field>
          <Field id="tpl-items" label="Itens (um por linha) *">
            <textarea id="tpl-items" className={textareaClass} value={items} onChange={(e) => setItems(e.target.value)} />
          </Field>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={create.isPending}>
            Criar modelo
          </Button>
        </form>
      )}

      {templates.isPending && <LoadingState />}
      {templates.isError && <ErrorState message="Não foi possível carregar os modelos." onRetry={() => templates.refetch()} />}
      {templates.isSuccess && templates.data.length === 0 && <EmptyState title="Nenhum modelo criado" />}
      {(templates.data ?? []).length > 0 && (
        <ul className="space-y-3">
          {templates.data!.map((t) => {
            const its = [...t.checklist_template_items].sort((a, b) => a.sort_order - b.sort_order)
            return (
              <li key={t.id} className="rounded-md border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{t.name}</p>
                    {t.category && <p className="text-sm text-muted-foreground">{t.category}</p>}
                  </div>
                  {canWrite && (
                    <Button variant="outline" size="sm" disabled={del.isPending} onClick={() => setDeleting({ id: t.id, name: t.name })}>
                      Excluir
                    </Button>
                  )}
                </div>
                <ol className="mt-2 list-inside list-decimal text-sm">
                  {its.map((i) => (
                    <li key={i.id}>{i.title}</li>
                  ))}
                </ol>
              </li>
            )
          })}
        </ul>
      )}
      <ConfirmDialog
        open={deleting !== null}
        title={`Excluir o modelo “${deleting?.name ?? ''}”?`}
        description="O modelo é removido definitivamente. Checklists já aplicados a tarefas não mudam, porque os itens foram copiados. Esta ação não pode ser desfeita."
        confirmLabel="Excluir modelo"
        pending={del.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return
          try {
            await del.mutateAsync(deleting.id)
          } finally {
            setDeleting(null)
          }
        }}
      />
    </>
  )
}

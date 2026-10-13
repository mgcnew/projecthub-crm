import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { EntityView } from '@/components/entity/EntityView'
import { useCurrentWorkspace } from '@/features/workspace/useCurrentWorkspace'
import { useCreateProject } from './api'
import { ProjectForm } from './ProjectForm'
import { projectDefaults } from './schema'

export function ProjectNewPage() {
  const { orgId, canWrite } = useCurrentWorkspace()
  const create = useCreateProject(orgId)
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  if (!canWrite) return <p role="alert">Você não tem permissão para criar projetos.</p>

  return (
    <EntityView
      kind="Projeto"
      title="Novo projeto"
      tabs={[
        {
          id: 'dados',
          label: 'Dados',
          content: (
            <ProjectForm
              initial={{ ...projectDefaults, client_id: params.get('cliente') ?? '' }}
              submitLabel="Criar projeto"
              serverError={error}
              onSubmit={async (values) => {
                setError(null)
                try {
                  const created = await create.mutateAsync(values)
                  navigate(`/app/projetos/${created.id}`, { replace: true })
                } catch {
                  setError('Não foi possível salvar o projeto. Tente novamente.')
                }
              }}
            />
          ),
        },
      ]}
    />
  )
}

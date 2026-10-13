import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { EntityView } from '@/components/entity/EntityView'
import { useCurrentWorkspace } from '@/features/workspace/useCurrentWorkspace'
import { useCreateAccess } from './api'
import { AccessForm } from './AccessForm'
import { accessDefaults } from './schema'

export function AccessNewPage() {
  const { orgId, canWrite } = useCurrentWorkspace()
  const create = useCreateAccess(orgId)
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  if (!canWrite) return <p role="alert">Você não tem permissão para criar acessos.</p>

  return (
    <EntityView
      kind="Acesso"
      title="Novo acesso"
      tabs={[
        {
          id: 'dados',
          label: 'Dados',
          content: (
            <AccessForm
              initial={{ ...accessDefaults, project_id: params.get('projeto') ?? '', client_id: params.get('cliente') ?? '' }}
              submitLabel="Criar acesso"
              serverError={error}
              onSubmit={async (values) => {
                setError(null)
                try {
                  const created = await create.mutateAsync(values)
                  navigate(`/app/acessos/${created.id}`, { replace: true })
                } catch {
                  setError('Não foi possível salvar o acesso. Tente novamente.')
                }
              }}
            />
          ),
        },
      ]}
    />
  )
}

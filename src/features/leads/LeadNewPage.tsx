import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { EntityView } from '@/components/entity/EntityView'
import { useCurrentWorkspace } from '@/features/workspace/useCurrentWorkspace'
import { useCreateLead } from './api'
import { LeadForm } from './LeadForm'
import { leadErrorMessage } from './schema'

export function LeadNewPage() {
  const { orgId, canWrite } = useCurrentWorkspace()
  const create = useCreateLead(orgId)
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  if (!canWrite) return <p role="alert">Você não tem permissão para criar leads.</p>

  return (
    <EntityView
      kind="Lead"
      title="Novo lead"
      tabs={[
        {
          id: 'dados',
          label: 'Dados',
          content: (
            <LeadForm
              submitLabel="Criar lead"
              serverError={error}
              onSubmit={async (values) => {
                setError(null)
                try {
                  const created = await create.mutateAsync(values)
                  navigate(`/app/prospeccao/leads/${created.id}`, { replace: true })
                } catch (e) {
                  setError(leadErrorMessage(e))
                }
              }}
            />
          ),
        },
      ]}
    />
  )
}

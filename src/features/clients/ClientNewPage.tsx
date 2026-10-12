import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/states'
import { useCurrentWorkspace } from '@/features/workspace/useCurrentWorkspace'
import { useCreateClient } from './api'
import { ClientForm } from './ClientForm'

export function ClientNewPage() {
  const { orgId, canWrite } = useCurrentWorkspace()
  const create = useCreateClient(orgId)
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  if (!canWrite) return <p role="alert">Você não tem permissão para criar clientes.</p>

  return (
    <>
      <PageHeader title="Novo cliente" />
      <ClientForm
        submitLabel="Criar cliente"
        serverError={error}
        onSubmit={async (values) => {
          setError(null)
          try {
            const created = await create.mutateAsync(values)
            navigate(`/app/clientes/${created.id}`, { replace: true })
          } catch {
            setError('Não foi possível salvar o cliente. Tente novamente.')
          }
        }}
      />
    </>
  )
}

import { Link } from 'react-router-dom'
import { Plate } from '@/components/Plate'
import { Button } from '@/components/ui/button'
import { useOutboxCounts } from './api'

/** "Aguardando aprovação" na Central do dia: rascunhos da prospecção à espera de revisão. Some quando não há. */
export function ApprovalsPlate({ enabled }: { enabled: boolean }) {
  const counts = useOutboxCounts(enabled).data
  if (!counts || counts.draft === 0) return null
  return (
    <Plate
      id="dash-approvals"
      title="Aguardando aprovação"
      meta={`${counts.draft} rascunho${counts.draft === 1 ? '' : 's'}`}
      action={
        <Button asChild variant="ghost" size="sm">
          <Link to="/app/prospeccao/fila">Revisar</Link>
        </Button>
      }
    >
      <p className="text-sm text-muted-foreground">
        Mensagens de prospecção prontas para você revisar e aprovar. Nada é enviado sem a sua aprovação.
      </p>
    </Plate>
  )
}

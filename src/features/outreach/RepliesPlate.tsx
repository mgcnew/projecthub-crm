import { Link } from 'react-router-dom'
import { Plate } from '@/components/Plate'
import { Button } from '@/components/ui/button'
import { useUnreadInboundCount } from './api'

/** "Respostas novas" na Central do dia: respostas de leads ainda não vistas. Some quando não há. */
export function RepliesPlate({ enabled }: { enabled: boolean }) {
  const n = useUnreadInboundCount(enabled).data ?? 0
  if (n === 0) return null
  return (
    <Plate
      id="dash-replies"
      title="Respostas novas"
      meta={`${n} ${n === 1 ? 'resposta' : 'respostas'}`}
      action={
        <Button asChild variant="ghost" size="sm">
          <Link to="/app/prospeccao/respostas">Ver respostas</Link>
        </Button>
      }
    >
      <p className="text-sm text-muted-foreground">Leads responderam à sua prospecção. Veja, marque como lida e, se fizer sentido, converta em cliente.</p>
    </Plate>
  )
}

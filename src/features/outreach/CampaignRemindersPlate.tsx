import { Link } from 'react-router-dom'
import { Plate } from '@/components/Plate'
import { Button } from '@/components/ui/button'
import { todayISO } from '@/lib/format'
import { useDueReminders } from './api'

/** "Lembretes de campanha" na Central do dia: lembretes vencidos esperando para virar rascunho. Some quando não há. */
export function CampaignRemindersPlate({ enabled }: { enabled: boolean }) {
  const due = useDueReminders(todayISO(), enabled).data ?? 0
  if (due === 0) return null
  return (
    <Plate
      id="dash-reminders"
      title="Lembretes de campanha"
      meta={`${due} para gerar`}
      action={
        <Button asChild variant="ghost" size="sm">
          <Link to="/app/prospeccao/campanhas">Abrir campanhas</Link>
        </Button>
      }
    >
      <p className="text-sm text-muted-foreground">Leads cujo lembrete venceu. Gere os rascunhos na campanha e aprove na fila.</p>
    </Plate>
  )
}

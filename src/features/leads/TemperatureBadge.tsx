import { Flame, Snowflake, Thermometer } from 'lucide-react'
import { StatusBadge } from '@/components/states'
import { temperatures, type Temperature } from './schema'

const icon = { cold: Snowflake, warm: Thermometer, hot: Flame } as const
const tone = { cold: 'neutral', warm: 'info', hot: 'danger' } as const

/** Temperatura do lead: texto e pictograma (nunca só cor); quente em placa sólida de tinta, sem vermelho. */
export function TemperatureBadge({ value }: { value: string }) {
  const t = (value in temperatures ? value : 'cold') as Temperature
  const Icon = icon[t]
  return (
    <StatusBadge tone={tone[t]}>
      <Icon aria-hidden="true" className="mr-1 size-3.5" />
      {temperatures[t]}
    </StatusBadge>
  )
}

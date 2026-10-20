import { Flame, Snowflake, Thermometer } from 'lucide-react'
import { StatusBadge } from '@/components/states'
import { temperatures, type Temperature } from './schema'

const icon = { cold: Snowflake, warm: Thermometer, hot: Flame } as const
const tone = { cold: 'info', warm: 'warning', hot: 'danger' } as const

/** Temperatura do lead: texto e pictograma (nunca só cor); frio azul, morno âmbar, quente vermelho. */
export function TemperatureBadge({ value }: { value: string }) {
  const t = (value in temperatures ? value : 'cold') as Temperature
  const Icon = icon[t]
  return (
    <StatusBadge tone={tone[t]} dot={false}>
      <Icon aria-hidden="true" className="-ml-0.5 size-3.5" />
      {temperatures[t]}
    </StatusBadge>
  )
}

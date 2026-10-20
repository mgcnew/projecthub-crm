import { Link } from 'react-router-dom'
import { layoutDay, nextStation, wallMinutes, type DayStop } from '@/lib/dayline'
import { formatMinutes, formatTime } from '@/lib/format'
import { lineFor } from '@/lib/lines'
import { cn } from '@/lib/utils'

export type { DayStop }

const kindLabel: Record<DayStop['kind'], string> = { event: 'Evento', meeting: 'Reunião', work_block: 'Bloco de foco' }

/**
 * A "Linha do dia": compromissos como estações sobre um trilho, coloridos pela linha do projeto.
 * Horizontal a partir de 768px; vertical (diagrama de vagão) abaixo disso. Uma única <ol> acessível.
 */
export function DayLine({
  stops,
  nowISO,
  label = 'Linha do dia',
  emptyText = 'Nenhum compromisso neste dia.',
}: {
  stops: DayStop[]
  /** Instante atual quando o dia exibido é hoje; marca a estação "agora". */
  nowISO?: string | null
  label?: string
  emptyText?: string
}) {
  const nowMin = nowISO ? wallMinutes(nowISO) : null
  const { placed, ticks, now } = layoutDay(stops, nowMin)
  const nowText = nowISO ? formatTime(nowISO) : ''

  if (placed.length === 0) {
    return (
      <div className="relative py-3">
        <div aria-hidden="true" className="h-2 rounded-full bg-[#e6e8ec]" />
        <p className="mt-3 text-sm text-muted-foreground">{emptyText}</p>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Trilho horizontal e marcas de hora (só desktop; decorativo, a lista carrega o conteúdo). */}
      <div aria-hidden="true" className="absolute inset-x-0 top-[3.75rem] hidden h-2 rounded-full bg-[#e6e8ec] md:block" />
      <div aria-hidden="true" className="hidden md:block">
        {placed.map((p) => {
          const line = lineFor(p.projectId)
          return (
            <span
              key={`seg-${p.key}`}
              className={cn(
                'absolute top-[3.75rem] h-2 rounded-full',
                p.kind === 'work_block' && 'opacity-55',
                line.outline && 'ring-1 ring-foreground ring-inset',
              )}
              style={{ left: `${p.from}%`, width: `${p.to - p.from}%`, backgroundColor: line.color }}
            />
          )
        })}
        {ticks.map((t) => (
          <span
            key={`tick-${t.h}`}
            className="absolute top-[7.6rem] -translate-x-1/2 text-[11px] font-medium text-muted-foreground"
            style={{ left: `${t.at}%` }}
          >
            {String(t.h).padStart(2, '0')}h
          </span>
        ))}
        {now !== null && (
          <span className="absolute top-[3.1rem] h-[2.2rem] w-0.5 -translate-x-1/2 rounded-full bg-now" style={{ left: `${now}%` }} />
        )}
      </div>

      <ol
        aria-label={label}
        className={cn(
          'relative grid gap-0',
          // Vertical: trilho à esquerda das estações.
          'before:absolute before:top-4 before:bottom-4 before:left-[4.69rem] before:w-1.5 before:rounded-full before:bg-[#e6e8ec] md:before:hidden',
          'md:block md:h-[10.25rem]',
        )}
      >
        {placed.map((p, i) => {
          const line = lineFor(p.projectId)
          const time = formatTime(p.start)
          return (
            <li
              key={p.key}
              className="grid grid-cols-[3.5rem_1.5rem_1fr] items-center gap-x-3 py-2 md:absolute md:inset-y-0 md:left-(--at) md:block md:w-0 md:py-0"
              style={{ '--at': `${p.from}%`, order: i * 2 } as React.CSSProperties}
            >
              <span className="text-sm font-semibold tabular-nums md:hidden">{time}</span>
              <span
                aria-hidden="true"
                className={cn(
                  'relative z-10 size-5 rounded-full border-[5px] bg-card shadow-card md:absolute md:top-[3.3rem] md:left-0 md:size-[1.375rem] md:-translate-x-1/2',
                  p.projectId && line.outline && 'shadow-[0_0_0_1.5px_var(--foreground)]',
                )}
                style={{ borderColor: p.projectId ? line.color : 'var(--foreground)' }}
              />
              <Link
                to={p.href}
                className={cn(
                  'group block min-h-11 content-center rounded-sm',
                  'md:absolute md:left-0 md:min-h-0 md:w-max md:max-w-48',
                  p.from > 72 ? 'md:-translate-x-[calc(100%-0.75rem)] md:text-right' : 'md:-translate-x-3',
                  p.level === 0 ? 'md:top-0' : 'md:top-[4.9rem]',
                )}
              >
                <span className="block truncate text-sm font-semibold group-hover:underline">{p.title}</span>
                <span className="block text-xs text-muted-foreground">
                  <span className="hidden md:inline">{time} · </span>
                  {kindLabel[p.kind]}
                </span>
              </Link>
            </li>
          )
        })}
        {now !== null && (
          <li
            className="grid grid-cols-[3.5rem_1.5rem_1fr] items-center gap-x-3 py-2 md:absolute md:inset-y-0 md:left-(--at) md:block md:w-0 md:py-0"
            style={{ '--at': `${now}%`, order: placed.filter((p) => p.from <= now).length * 2 - 1 } as React.CSSProperties}
          >
            <span className="text-sm font-semibold text-destructive tabular-nums md:hidden">{nowText}</span>
            <span
              aria-hidden="true"
              className="relative z-10 size-5 rounded-full border-[5px] border-now bg-card md:absolute md:top-[3.3rem] md:left-0 md:size-[1.375rem] md:-translate-x-1/2"
            />
            <span className="text-sm font-semibold text-destructive md:absolute md:top-[8.55rem] md:left-0 md:w-max md:-translate-x-1/2 md:rounded-full md:bg-tone-danger-bg md:px-2 md:py-0.5 md:text-xs">
              Agora<span className="hidden md:inline"> {nowText}</span>
            </span>
          </li>
        )}
      </ol>
      {nowISO && <NextStation stops={stops} nowISO={nowISO} />}
    </div>
  )
}

/** "Próxima estação": a frase da sinalização, com o compromisso em andamento quando houver. */
function NextStation({ stops, nowISO }: { stops: DayStop[]; nowISO: string }) {
  const { current, next, minutes } = nextStation(stops, nowISO)
  if (!current && !next) return null
  return (
    <p className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1 border-t border-border pt-3 text-sm md:mt-1">
      {current && (
        <span>
          <span className="font-semibold">Em andamento</span>
          <span aria-hidden="true" className="px-1 text-muted-foreground">·</span>
          <Link to={current.href} className="hover:underline">{current.title}</Link> até {formatTime(current.end)}
          {next && <span aria-hidden="true" className="px-1 text-muted-foreground">·</span>}
        </span>
      )}
      {next && minutes !== null && (
        <span>
          <span className="font-semibold">Próxima estação</span>
          <span className="px-1 text-muted-foreground tabular-nums">· {formatTime(next.start)} ·</span>
          <Link to={next.href} className="font-semibold hover:underline">{next.title}</Link>{' '}
          <span className="text-muted-foreground tabular-nums">· em {formatMinutes(minutes)}</span>
        </span>
      )}
    </p>
  )
}

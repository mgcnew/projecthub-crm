import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { WEEKDAYS_LONG, WEEKDAYS_SHORT, dayLabel, monthGrid, monthLabel, sameMonth, shiftMonth } from '@/lib/calendar'
import { addDays } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * Grade do mês (domingo a sábado). Um único botão da grade entra na ordem do Tab (o do dia em foco);
 * setas movem o dia, PageUp/PageDown o mês (Shift: o ano), Home/End vão ao início/fim da semana.
 */
export function Calendar({
  selected,
  today,
  onPick,
}: {
  selected: string
  today: string
  onPick: (iso: string) => void
}) {
  const [focus, setFocus] = useState(selected || today)
  const grid = useRef<HTMLTableElement>(null)
  const moved = useRef(false)

  // Ao abrir, o foco entra na grade (dia selecionado ou hoje).
  useEffect(() => {
    grid.current?.querySelector<HTMLButtonElement>('button[tabindex="0"]')?.focus()
  }, [])

  // Depois de um movimento por teclado/botão, leva o foco real ao botão do novo dia.
  useEffect(() => {
    if (!moved.current) return
    moved.current = false
    grid.current?.querySelector<HTMLButtonElement>(`[data-iso="${focus}"]`)?.focus()
  }, [focus])

  const days = monthGrid(focus)
  const weeks = Array.from({ length: 6 }, (_, i) => days.slice(i * 7, i * 7 + 7))
  const go = (iso: string) => {
    moved.current = true
    setFocus(iso)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    const dow = days.indexOf(focus) % 7
    let next: string | null = null
    if (e.key === 'ArrowLeft') next = addDays(focus, -1)
    else if (e.key === 'ArrowRight') next = addDays(focus, 1)
    else if (e.key === 'ArrowUp') next = addDays(focus, -7)
    else if (e.key === 'ArrowDown') next = addDays(focus, 7)
    else if (e.key === 'Home') next = addDays(focus, -dow)
    else if (e.key === 'End') next = addDays(focus, 6 - dow)
    else if (e.key === 'PageUp') next = shiftMonth(focus, e.shiftKey ? -12 : -1)
    else if (e.key === 'PageDown') next = shiftMonth(focus, e.shiftKey ? 12 : 1)
    if (next) {
      e.preventDefault()
      go(next)
    }
  }

  const navBtn =
    'inline-flex size-10 items-center justify-center rounded-md border border-border-strong bg-card hover:bg-muted pointer-coarse:size-11'

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <button type="button" className={navBtn} aria-label="Mês anterior" onClick={() => setFocus(shiftMonth(focus, -1))}>
          <ChevronLeft aria-hidden="true" className="size-5" />
        </button>
        <p className="text-sm font-bold first-letter:uppercase" aria-live="polite">
          {monthLabel(focus)}
        </p>
        <button type="button" className={navBtn} aria-label="Próximo mês" onClick={() => setFocus(shiftMonth(focus, 1))}>
          <ChevronRight aria-hidden="true" className="size-5" />
        </button>
      </div>

      <table ref={grid} role="grid" aria-label={monthLabel(focus)} onKeyDown={onKeyDown} className="w-full border-collapse">
        <thead>
          <tr>
            {WEEKDAYS_SHORT.map((w, i) => (
              <th key={w} scope="col" abbr={WEEKDAYS_LONG[i]} className="pb-1 text-center text-xs font-semibold text-muted-foreground">
                {w}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week[0]}>
              {week.map((iso) => {
                const inMonth = sameMonth(iso, focus)
                const isSelected = iso === selected
                const isToday = iso === today
                return (
                  <td key={iso} role="gridcell" className="p-0 text-center">
                    <button
                      type="button"
                      data-iso={iso}
                      tabIndex={iso === focus ? 0 : -1}
                      aria-label={dayLabel(iso)}
                      aria-pressed={isSelected}
                      aria-current={isToday ? 'date' : undefined}
                      onClick={() => onPick(iso)}
                      className={cn(
                        'mx-auto flex size-10 items-center justify-center rounded-sm text-sm tabular-nums pointer-coarse:size-11',
                        'focus-visible:outline-[3px] focus-visible:outline-ring/60',
                        isSelected
                          ? 'bg-primary font-bold text-primary-foreground'
                          : inMonth
                            ? 'font-medium hover:bg-muted'
                            : 'text-muted-foreground hover:bg-muted',
                        isToday && !isSelected && 'bg-tone-info-bg font-bold text-primary-strong ring-1 ring-primary/40 ring-inset',
                      )}
                    >
                      {Number(iso.slice(8))}
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

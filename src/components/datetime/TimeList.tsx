import { useEffect, useRef } from 'react'
import { TIME_STEPS } from '@/lib/calendar'
import { cn } from '@/lib/utils'

/** Lista de horários de 15 em 15 min (inclui o valor atual se ele não cair na grade). ↑/↓/Home/End movem. */
export function TimeList({
  value,
  onPick,
  className,
  autoFocus = false,
}: {
  value: string
  onPick: (hm: string) => void
  className?: string
  autoFocus?: boolean
}) {
  const box = useRef<HTMLDivElement>(null)
  const options = value && !TIME_STEPS.includes(value) ? [...TIME_STEPS, value].sort() : TIME_STEPS
  const current = value || '09:00'
  const nearest = options.includes(current) ? current : options[0]

  // Abre rolado até o horário atual.
  useEffect(() => {
    const el = box.current?.querySelector<HTMLElement>(`[data-time="${nearest}"]`)
    if (el && box.current) box.current.scrollTop = el.offsetTop - box.current.clientHeight / 2 + el.clientHeight / 2
    if (autoFocus) el?.focus({ preventScroll: true })
  }, [nearest, autoFocus])

  const move = (target: HTMLElement, to: HTMLElement | null) => {
    if (!to) return
    to.focus()
    void target
  }

  return (
    <div
      ref={box}
      role="listbox"
      aria-label="Horário"
      className={cn('max-h-52 overflow-y-auto border border-border', className)}
      onKeyDown={(e) => {
        const t = e.target as HTMLElement
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          move(t, t.nextElementSibling as HTMLElement | null)
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          move(t, t.previousElementSibling as HTMLElement | null)
        } else if (e.key === 'Home') {
          e.preventDefault()
          move(t, box.current?.firstElementChild as HTMLElement | null)
        } else if (e.key === 'End') {
          e.preventDefault()
          move(t, box.current?.lastElementChild as HTMLElement | null)
        }
      }}
    >
      {options.map((hm) => {
        const selected = hm === value
        return (
          <button
            key={hm}
            type="button"
            role="option"
            aria-selected={selected}
            data-time={hm}
            tabIndex={hm === nearest ? 0 : -1}
            onClick={() => onPick(hm)}
            className={cn(
              'block min-h-10 w-full px-3 text-left text-sm tabular-nums pointer-coarse:min-h-11',
              'focus-visible:outline-[3px] focus-visible:-outline-offset-2 focus-visible:outline-ring/60',
              selected ? 'bg-foreground font-bold text-card' : 'hover:bg-muted',
            )}
          >
            {hm}
          </button>
        )
      })}
    </div>
  )
}

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { cn } from '@/lib/utils'

export type PageTab = { id: string; label: string; icon?: LucideIcon; content: ReactNode }

/** Parâmetro de URL da aba ativa (`?aba=seguranca`): o link abre direto na aba, como nos registros. */
const TAB_PARAM = 'aba'

/**
 * Abas de página (ex.: Configurações). Mesmo padrão ARIA das abas de registro: setas, Home/End e foco
 * itinerante; a aba ativa vai para a URL e os painéis visitados ficam montados (o que foi digitado em um
 * formulário não se perde ao trocar de aba).
 */
export function PageTabs({ tabs, label }: { tabs: PageTab[]; label: string }) {
  const [params, setParams] = useSearchParams()
  const baseId = useId()
  const listRef = useRef<HTMLDivElement>(null)
  const requested = params.get(TAB_PARAM)
  const active = tabs.some((t) => t.id === requested) ? (requested as string) : tabs[0].id
  const [visited, setVisited] = useState<Set<string>>(() => new Set([active]))
  const visitedNow = visited.has(active) ? visited : new Set(visited).add(active)
  if (visitedNow !== visited) setVisited(visitedNow)

  const select = (id: string, focus = false) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (id === tabs[0].id) next.delete(TAB_PARAM)
        else next.set(TAB_PARAM, id)
        return next
      },
      { replace: true },
    )
    if (focus) requestAnimationFrame(() => listRef.current?.querySelector<HTMLElement>(`[data-tab="${id}"]`)?.focus())
  }

  const onKeyDown = (e: KeyboardEvent) => {
    const i = tabs.findIndex((t) => t.id === active)
    const go = (n: number) => select(tabs[(n + tabs.length) % tabs.length].id, true)
    if (e.key === 'ArrowRight') go(i + 1)
    else if (e.key === 'ArrowLeft') go(i - 1)
    else if (e.key === 'Home') go(0)
    else if (e.key === 'End') go(tabs.length - 1)
    else return
    e.preventDefault()
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-border">
        <div ref={listRef} role="tablist" aria-label={label} onKeyDown={onKeyDown} className="-mb-px flex gap-1 overflow-x-auto">
          {tabs.map((t) => {
            const on = t.id === active
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`${baseId}-tab-${t.id}`}
                data-tab={t.id}
                aria-selected={on}
                aria-controls={`${baseId}-panel-${t.id}`}
                tabIndex={on ? 0 : -1}
                onClick={() => select(t.id)}
                className={cn(
                  'inline-flex min-h-11 shrink-0 items-center gap-2 border-b-[3px] px-3 text-sm font-semibold whitespace-nowrap transition-colors duration-150 ease-out',
                  on ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {t.icon && <t.icon aria-hidden="true" className={cn('size-4', on && 'text-primary')} strokeWidth={2} />}
                {t.label}
              </button>
            )
          })}
        </div>
      </div>
      {tabs.map((t) =>
        visitedNow.has(t.id) ? (
          <div
            key={t.id}
            role="tabpanel"
            id={`${baseId}-panel-${t.id}`}
            aria-labelledby={`${baseId}-tab-${t.id}`}
            hidden={t.id !== active}
            className="max-w-3xl space-y-6"
          >
            {t.content}
          </div>
        ) : null,
      )}
    </div>
  )
}

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/states'
import { cn } from '@/lib/utils'
import { useOverlay } from './OverlayContext'

export type EntityTab = {
  id: string
  label: string
  /** Contador/indicador curto ao lado do rótulo (opcional). */
  badge?: ReactNode
  content: ReactNode
}

/** Parâmetro de URL da aba ativa (`?aba=lembretes`): o link abre direto na aba. */
const TAB_PARAM = 'aba'

/**
 * Tela de registro (tarefa, projeto, cliente…): cabeçalho + abas por assunto. No desktop vive dentro do
 * painel (`EntityOverlay`); no celular é a própria página. Abas seguem o padrão ARIA (setas, Home/End);
 * painéis são carregados só ao abrir e ficam montados depois (formulário digitado não se perde).
 */
export function EntityView({
  kind,
  title,
  description,
  actions,
  tabs,
  children,
}: {
  kind: string
  title: string
  description?: ReactNode
  actions?: ReactNode
  tabs: EntityTab[]
  /** Sempre montado (ex.: diálogos de confirmação); não pertence a nenhuma aba. */
  children?: ReactNode
}) {
  const overlay = useOverlay()
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

  const tablist =
    tabs.length > 1 ? (
      <div
        ref={listRef}
        role="tablist"
        aria-label={`Seções de ${kind.toLowerCase()}`}
        onKeyDown={onKeyDown}
        className="-mb-px flex gap-1 overflow-x-auto"
      >
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
                'inline-flex min-h-11 shrink-0 items-center gap-2 border-b-[3px] px-3 text-sm font-semibold whitespace-nowrap',
                on ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label}
              {t.badge !== undefined && t.badge !== null && (
                <span className="rounded-full bg-muted px-1.5 text-xs text-muted-foreground tabular-nums">{t.badge}</span>
              )}
            </button>
          )
        })}
      </div>
    ) : null

  const panels = tabs.map((t) =>
    visitedNow.has(t.id) ? (
      <div
        key={t.id}
        role={tabs.length > 1 ? 'tabpanel' : undefined}
        id={`${baseId}-panel-${t.id}`}
        aria-labelledby={tabs.length > 1 ? `${baseId}-tab-${t.id}` : undefined}
        hidden={t.id !== active}
        className="space-y-6 pt-5"
      >
        {t.content}
      </div>
    ) : null,
  )

  if (overlay) {
    return (
      <>
        <div className="sticky top-0 z-10 -mx-5 space-y-3 border-b border-border bg-card px-5 pt-5">
          <div className="space-y-1 pr-24">
            <h2 id={overlay.titleId} className="text-[1.5rem] leading-tight font-bold tracking-[-0.02em]">
              {title}
            </h2>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.9375rem] text-muted-foreground">
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-tone-neutral">{kind}</span>
              {description}
            </div>
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
          {tablist}
        </div>
        {panels}
        {children}
      </>
    )
  }

  return (
    <>
      <PageHeader title={title} description={description} actions={actions} />
      {tablist && <div className="border-b border-border">{tablist}</div>}
      {panels}
      {children}
    </>
  )
}

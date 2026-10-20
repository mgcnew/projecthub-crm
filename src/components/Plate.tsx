import type { ReactNode } from 'react'

/**
 * Cartão de seção: superfície branca de cantos suaves; título à
 * esquerda, contagem logo ao lado e a ação à direita.
 */
export function Plate({
  id,
  title,
  meta,
  action,
  children,
}: {
  id: string
  title: string
  meta?: ReactNode
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section aria-labelledby={id} className="plate min-w-0">
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3 sm:items-center sm:px-5">
        <h2 id={id} className="section-title min-w-0 flex-1 pt-2 sm:pt-0">
          {title}
          {meta && (
            <span className="mt-0.5 block font-semibold tracking-normal text-muted-foreground normal-case sm:mt-0 sm:ml-2 sm:inline">
              {meta}
            </span>
          )}
        </h2>
        {action && <div className="flex shrink-0 gap-2">{action}</div>}
      </div>
      <div className="px-4 pt-4 pb-5 sm:px-5">{children}</div>
    </section>
  )
}

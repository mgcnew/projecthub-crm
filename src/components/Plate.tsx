import type { ReactNode } from 'react'

/**
 * Placa de seção (mundo "Linhas do Metrô"): superfície branca com régua fina; título em caixa alta à
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
      <div className="flex items-start justify-between gap-3 px-4 pt-3 pb-2 sm:items-center sm:px-5">
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
      <div className="px-4 pb-4 sm:px-5">{children}</div>
    </section>
  )
}

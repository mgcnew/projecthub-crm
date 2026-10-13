import { useId, useState, type ReactNode } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Busca sempre visível + filtros. No desktop tudo numa linha; abaixo de 768px os filtros recolhem atrás
 * de "Filtros" para a lista aparecer na primeira tela do celular (consulta rápida).
 */
export function FilterBar({
  search,
  children,
  activeCount = 0,
  className,
}: {
  search: ReactNode
  children: ReactNode
  activeCount?: number
  /** Grade do desktop (ex.: 'md:grid-cols-[1fr_12rem_12rem]'). */
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <div className={cn('grid gap-3 md:grid', className)}>
      <div className="flex gap-2 md:contents">
        <div className="min-w-0 flex-1">{search}</div>
        <Button
          type="button"
          variant="outline"
          className="h-11 md:hidden"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((o) => !o)}
        >
          <SlidersHorizontal aria-hidden="true" />
          Filtros{activeCount > 0 && <span className="tabular-nums"> ({activeCount})</span>}
        </Button>
      </div>
      <div id={id} className={cn('gap-3 md:contents', open ? 'grid' : 'hidden')}>
        {children}
      </div>
    </div>
  )
}

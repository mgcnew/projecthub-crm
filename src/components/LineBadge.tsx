import { lineFor, lineInitial } from '@/lib/lines'
import { cn } from '@/lib/utils'

/**
 * Selo de linha (o círculo numerado da sinalização do metrô): a cor identifica o projeto e a
 * inicial reforça sem depender só da cor. O nome do projeto é o nome acessível.
 */
export function LineBadge({
  projectId,
  projectName,
  size = 'md',
  className,
}: {
  projectId: string | null | undefined
  projectName: string | null | undefined
  size?: 'sm' | 'md'
  className?: string
}) {
  const line = lineFor(projectId)
  const label = projectId ? (projectName ?? 'Projeto') : 'Sem projeto'
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-bold leading-none select-none',
        size === 'md' ? 'size-6 text-xs' : 'size-5 text-[11px]',
        line.outline && 'ring-1 ring-foreground ring-inset',
        className,
      )}
      style={{ backgroundColor: line.color, color: line.ink }}
    >
      {projectId ? lineInitial(projectName) : '—'}
    </span>
  )
}

/** Faixa vertical da cor de linha, para bordas de linha em listas. */
export function LineStrip({ projectId, className }: { projectId: string | null | undefined; className?: string }) {
  const line = lineFor(projectId)
  return (
    <span
      aria-hidden="true"
      className={cn('w-1 shrink-0 self-stretch rounded-full', line.outline && 'ring-1 ring-foreground ring-inset', className)}
      style={{ backgroundColor: line.color }}
    />
  )
}

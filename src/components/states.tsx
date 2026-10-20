import type { ReactNode } from 'react'
import { AlertTriangle, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** Cabeçalho de página: título (28px, 700, justo) com a descrição abaixo e ações à direita. */
export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 pb-1">
      <div className="min-w-0 space-y-1">
        <h1 className="text-[1.625rem] leading-tight font-bold tracking-[-0.025em] sm:text-[1.75rem]">{title}</h1>
        {description && <p className="text-[0.9375rem] text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  )
}

/** Carregando: barras no cartão, sem texto solto no meio da tela; o rótulo fica para leitores de tela. */
export function LoadingState({ label = 'Carregando…', rows = 3 }: { label?: string; rows?: number }) {
  return (
    <div role="status" className="plate space-y-3 p-4">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} aria-hidden="true" className="flex items-center gap-3">
          <span className="size-5 animate-pulse rounded-full bg-muted" />
          <span className="h-3 animate-pulse rounded-full bg-muted" style={{ width: `${70 - i * 14}%` }} />
        </div>
      ))}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-[#f5c6c9] bg-tone-danger-bg p-4">
      <IconChip icon={AlertTriangle} tone="danger" />
      <p className="flex-1 font-medium text-destructive">{message}</p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          Tentar novamente
        </Button>
      )}
    </div>
  )
}

/** Vazio: área tracejada (ou sem moldura dentro de um cartão); sempre oferece a próxima ação. */
export function EmptyState({
  title,
  description,
  action,
  icon,
  inset = false,
}: {
  title: string
  description?: string
  action?: ReactNode
  icon?: LucideIcon
  /** Dentro de um cartão: sem moldura própria (cartão dentro de cartão não). */
  inset?: boolean
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-2 px-6 text-center',
        inset ? 'py-10' : 'rounded-lg border border-dashed border-border-strong bg-card py-8',
      )}
    >
      {icon && <IconChip icon={icon} tone="neutral" size="lg" className="mb-1" />}
      <p className="font-semibold">{title}</p>
      {description && <p className="max-w-[46ch] text-sm text-muted-foreground">{description}</p>}
      {action && <div className="pt-2">{action}</div>}
    </div>
  )
}

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'violet'

// Pares pastel + tinta (tokens --tone-*): a cor reforça o estado, o texto sempre o nomeia.
const tones: Record<Tone, string> = {
  neutral: 'bg-tone-neutral-bg text-tone-neutral',
  info: 'bg-tone-info-bg text-tone-info',
  success: 'bg-tone-success-bg text-tone-success',
  warning: 'bg-tone-warning-bg text-tone-warning',
  danger: 'bg-tone-danger-bg text-tone-danger',
  violet: 'bg-tone-violet-bg text-tone-violet',
}

/** Selo de situação: pílula pastel com ponto da mesma cor; sempre com texto, nunca só cor. */
export function StatusBadge({ tone = 'neutral', dot = true, children }: { tone?: Tone; dot?: boolean; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
        tones[tone],
      )}
    >
      {dot && <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" />}
      {children}
    </span>
  )
}

/** Chip de ícone: quadrado arredondado em pastel com o pictograma na tinta do mesmo tom. */
export function IconChip({
  icon: Icon,
  tone = 'neutral',
  size = 'md',
  className,
}: {
  icon: LucideIcon
  tone?: Tone
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center',
        size === 'sm' && 'size-7 rounded-md',
        size === 'md' && 'size-9 rounded-[0.625rem]',
        size === 'lg' && 'size-11 rounded-lg',
        tones[tone],
        className,
      )}
    >
      <Icon className={size === 'sm' ? 'size-3.5' : size === 'md' ? 'size-[1.125rem]' : 'size-5'} strokeWidth={2} />
    </span>
  )
}

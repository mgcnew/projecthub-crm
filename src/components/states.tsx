import type { ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** Cabeçalho de página: título de placa (30px, 700, justo) com a descrição abaixo e ações à direita. */
export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b-2 border-rule-strong pb-4">
      <div className="min-w-0 space-y-1">
        <h1 className="text-[1.75rem] leading-tight font-bold tracking-[-0.02em] sm:text-[1.875rem]">{title}</h1>
        {description && <p className="text-[0.9375rem] text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  )
}

/** Carregando: barras de placa, sem texto solto no meio da tela; o rótulo fica para leitores de tela. */
export function LoadingState({ label = 'Carregando…', rows = 3 }: { label?: string; rows?: number }) {
  return (
    <div role="status" className="plate space-y-3 p-4">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} aria-hidden="true" className="flex items-center gap-3">
          <span className="size-5 animate-pulse rounded-full bg-muted" />
          <span className="h-3 animate-pulse bg-muted" style={{ width: `${70 - i * 14}%` }} />
        </div>
      ))}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 border border-destructive bg-card p-4">
      <AlertTriangle aria-hidden="true" className="size-5 shrink-0 text-destructive" />
      <p className="flex-1 font-medium text-destructive">{message}</p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          Tentar novamente
        </Button>
      )}
    </div>
  )
}

/** Vazio: placa tracejada, como um espaço de placa ainda sem sinal; sempre oferece a próxima ação. */
export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="space-y-2 border border-dashed border-input bg-card px-6 py-8 text-center">
      <p className="font-semibold">{title}</p>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
      {action && <div className="pt-2">{action}</div>}
    </div>
  )
}

// Placas em tinta, sem cor de fundo: a cor é das linhas (projetos) e o vermelho é de "agora"/atraso.
// A ênfase vem do peso e do preenchimento: contorno fino < contorno em tinta < placa sólida.
const tones = {
  neutral: 'border border-border bg-card text-foreground',
  info: 'border border-foreground bg-card text-foreground',
  success: 'border border-transparent bg-muted text-muted-foreground',
  warning: 'border border-transparent bg-transparent px-0 font-bold text-foreground',
  danger: 'border border-foreground bg-foreground text-card',
} as const

/** Selo de situação: placa retangular pequena; sempre com texto, nunca só cor. */
export function StatusBadge({ tone = 'neutral', children }: { tone?: keyof typeof tones; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-semibold whitespace-nowrap',
        tones[tone],
      )}
    >
      {children}
    </span>
  )
}

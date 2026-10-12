import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </header>
  )
}

export function LoadingState({ label = 'Carregando…' }: { label?: string }) {
  return (
    <p role="status" className="py-8 text-center text-muted-foreground">
      {label}
    </p>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="space-y-3 rounded-md border border-destructive/40 bg-card p-4">
      <p className="text-destructive">{message}</p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          Tentar novamente
        </Button>
      )}
    </div>
  )
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="space-y-3 rounded-md border border-dashed border-border bg-card p-8 text-center">
      <p className="font-medium">{title}</p>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
      {action}
    </div>
  )
}

const tones = {
  neutral: 'bg-muted text-muted-foreground',
  success: 'bg-success/15 text-emerald-800',
  warning: 'bg-warning/20 text-amber-900',
  danger: 'bg-destructive/15 text-red-800',
  info: 'bg-primary/10 text-primary',
} as const

export function StatusBadge({ tone = 'neutral', children }: { tone?: keyof typeof tones; children: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', tones[tone])}>
      {children}
    </span>
  )
}

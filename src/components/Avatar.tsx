import { cn } from '@/lib/utils'

/** Iniciais do nome (até duas letras); sem nome, a primeira letra do e-mail. */
export function initials(name: string | null | undefined, email?: string | null) {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (words.length >= 2) return (words[0][0] + words[words.length - 1][0]).toLocaleUpperCase('pt-BR')
  if (words.length === 1) return words[0].slice(0, 2).toLocaleUpperCase('pt-BR')
  return (email?.[0] ?? '?').toLocaleUpperCase('pt-BR')
}

/** Avatar por iniciais (o app ainda não guarda foto): círculo em azul suave, decorativo. */
export function Avatar({ name, email, size = 'md', className }: { name?: string | null; email?: string | null; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-tone-info-bg font-bold text-primary select-none',
        size === 'sm' && 'size-8 text-xs',
        size === 'md' && 'size-10 text-sm',
        size === 'lg' && 'size-16 text-xl',
        className,
      )}
    >
      {initials(name, email)}
    </span>
  )
}

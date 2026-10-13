import { Check, Copy } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * Copia um texto para a área de transferência com 1 clique. O nome acessível descreve o que é copiado;
 * o aviso "Copiado" também vai para leitores de tela (região de status).
 */
export function CopyButton({ text, label, className }: { text: string; label: string; className?: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'error'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  const copy = async () => {
    clearTimeout(timer.current)
    try {
      await navigator.clipboard.writeText(text)
      setState('copied')
    } catch {
      setState('error')
    }
    timer.current = setTimeout(() => setState('idle'), 2000)
  }

  return (
    <>
      <button
        type="button"
        aria-label={label}
        onClick={copy}
        className={cn(
          'inline-flex min-h-11 items-center gap-1.5 rounded-sm border border-input bg-card px-2.5 text-sm font-semibold hover:bg-muted focus-visible:outline-[3px] focus-visible:outline-ring/40',
          className,
        )}
      >
        {state === 'copied' ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
        <span aria-hidden="true">{state === 'copied' ? 'Copiado' : state === 'error' ? 'Não copiou' : 'Copiar'}</span>
      </button>
      <span role="status" className="sr-only">
        {state === 'copied' ? 'Copiado para a área de transferência' : state === 'error' ? 'Não foi possível copiar' : ''}
      </span>
    </>
  )
}

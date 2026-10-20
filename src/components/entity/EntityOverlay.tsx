import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Maximize2, Minimize2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { OverlayContext } from './OverlayContext'

const STORAGE_KEY = 'projecthub:overlay-expanded'

function readExpanded() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Painel de registro do desktop sobre o <dialog> modal nativo: lateral por padrão e "expandível" para
 * um modal central grande (a preferência fica no navegador). Esc e clique no fundo fecham; o foco
 * fica contido e volta ao elemento de origem. Sem biblioteca (scroll lock de libs viola a CSP estrita).
 */
export function EntityOverlay({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [expanded, setExpanded] = useState(readExpanded)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (!dialog.open) dialog.showModal()
    const root = document.documentElement
    const previous = root.style.overflow
    root.style.overflow = 'hidden'
    return () => {
      root.style.overflow = previous
      if (dialog.open) dialog.close()
    }
  }, [])

  const toggle = () =>
    setExpanded((v) => {
      try {
        localStorage.setItem(STORAGE_KEY, v ? '0' : '1')
      } catch {
        // sem armazenamento: vale só nesta sessão
      }
      return !v
    })

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-label="Detalhes do registro"
      data-expanded={expanded}
      onCancel={(e) => {
        e.preventDefault()
        // Esc de um diálogo aninhado (ex.: confirmação) é dele; o painel só fecha com o próprio Esc.
        if (e.target !== ref.current || ref.current?.querySelector('dialog[open]')) return
        onClose()
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
      className={cn(
        'overlay-panel fixed bg-card p-0 text-card-foreground backdrop:bg-foreground/35 open:flex open:flex-col',
        expanded
          ? 'inset-0 m-auto h-[min(50rem,92dvh)] w-[min(66rem,94vw)] rounded-xl border border-border shadow-pop'
          : 'inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-[min(42rem,100vw)] border-l border-border shadow-pop',
      )}
    >
      <div className="absolute top-3 right-3 z-20 flex gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={toggle}
          aria-label={expanded ? 'Voltar ao painel lateral' : 'Expandir para modal grande'}
          aria-pressed={expanded}
        >
          {expanded ? <Minimize2 aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Fechar">
          <X aria-hidden="true" />
        </Button>
      </div>
      <OverlayContext.Provider value={{ titleId, expanded }}>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">{children}</div>
      </OverlayContext.Provider>
    </dialog>
  )
}

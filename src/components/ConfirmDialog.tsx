import { useEffect, useId, useRef, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'

/**
 * Confirmação de ação pouco reversível, sobre o <dialog> modal nativo: foco preso no diálogo, resto da
 * página inerte, Esc fecha e o foco volta ao botão que abriu. O foco inicial vai para "Voltar" (a opção
 * segura). Sem biblioteca: scroll lock e portais de libs injetam <style> e violariam a CSP estrita.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Voltar',
  tone = 'danger',
  pending = false,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  description: ReactNode
  confirmLabel: string
  cancelLabel?: string
  tone?: 'danger' | 'default'
  pending?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const cancelButton = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const descId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      cancelButton.current?.focus() // opção segura; não depender da heurística do navegador
    }
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      role="alertdialog"
      aria-labelledby={titleId}
      aria-describedby={descId}
      // Esc: o estado `open` é a fonte da verdade, então o fechamento nativo é cancelado e delegado.
      onCancel={(e) => {
        e.preventDefault()
        if (!pending) onCancel()
      }}
      // Mantém o Tab dentro do diálogo (o <dialog> nativo deixa o foco escapar para a interface do navegador).
      onKeyDown={(e) => {
        if (e.key !== 'Tab' || !ref.current) return
        const items = ref.current.querySelectorAll<HTMLElement>('button:not([disabled])')
        if (items.length === 0) return
        const first = items[0]
        const last = items[items.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }}
      // Clique no fundo (o próprio <dialog>, fora do conteúdo) cancela.
      onClick={(e) => {
        if (e.target === ref.current && !pending) onCancel()
      }}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-sm border-2 border-foreground bg-card p-0 text-card-foreground shadow-[0_18px_40px_-12px_rgb(17_20_24/0.35)] backdrop:bg-foreground/45"
    >
      <div className="space-y-4 p-6">
        <h2 id={titleId} className="text-lg font-bold tracking-[-0.01em]">
          {title}
        </h2>
        <div id={descId} className="text-sm text-muted-foreground">
          {description}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button ref={cancelButton} variant="outline" disabled={pending} onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={tone === 'danger' ? 'destructive' : 'default'} disabled={pending} onClick={onConfirm}>
            {pending ? 'Aguarde…' : confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  )
}

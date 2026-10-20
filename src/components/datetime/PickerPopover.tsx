import { useEffect, useRef, type ReactNode, type RefObject } from 'react'
import { cn } from '@/lib/utils'

/**
 * Popover do seletor: camada superior (Popover API, modo manual) ancorada ao campo. Fica por cima de
 * diálogos e painéis sem ser cortado, fecha com Esc (sem fechar o painel por baixo), clique fora ou
 * perda de foco, e reposiciona ao rolar. Não usa biblioteca nem <style> (CSP estrita).
 */
export function PickerPopover({
  open,
  anchor,
  label,
  onClose,
  className,
  children,
}: {
  open: boolean
  anchor: RefObject<HTMLElement | null>
  label: string
  onClose: (reason: 'escape' | 'outside' | 'blur') => void
  className?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof el.showPopover !== 'function') return
    const isOpen = el.matches(':popover-open')
    if (open && !isOpen) el.showPopover()
    if (!open && isOpen) el.hidePopover()
  }, [open])

  useEffect(() => {
    if (!open) return
    const place = () => {
      const el = ref.current
      const a = anchor.current
      if (!el || !a) return
      const r = a.getBoundingClientRect()
      const w = el.offsetWidth
      const h = el.offsetHeight
      const below = r.bottom + 4
      const fitsBelow = below + h <= window.innerHeight - 8
      const top = fitsBelow || r.top - h - 4 < 8 ? below : r.top - h - 4
      const left = Math.min(Math.max(r.right - w, 8), Math.max(window.innerWidth - w - 8, 8))
      el.style.top = `${Math.max(top, 8)}px`
      el.style.left = `${left}px`
    }
    place()
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (ref.current?.contains(t) || anchor.current?.contains(t)) return
      onClose('outside')
    }
    // Esc fecha só o seletor (captura no documento: o foco pode estar no campo ou no botão, fora do popover).
    // preventDefault impede o fechamento nativo do diálogo/painel que contém o campo.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      onClose('escape')
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, anchor, onClose])

  return (
    <div
      ref={ref}
      popover="manual"
      role="dialog"
      aria-label={label}
      onBlur={(e) => {
        const next = e.relatedTarget as Node | null
        if (next && !e.currentTarget.contains(next) && !anchor.current?.contains(next)) onClose('blur')
      }}
      className={cn(
        'm-0 inset-auto w-[min(21rem,calc(100vw-1rem))] rounded-xl border border-border bg-card p-3 text-card-foreground shadow-pop',
        className,
      )}
    >
      {open ? children : null}
    </div>
  )
}

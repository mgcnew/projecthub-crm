import { cn } from '@/lib/utils'

/**
 * Classes do elemento que recebe a dica (precisa ser `position: relative` e agrupar o hover/foco).
 * Use junto de <TooltipBubble /> como filho direto: a dica no tema do sistema substitui o `title`
 * nativo do navegador.
 */
export const tooltipHost = 'group/tip relative'

const sides = {
  right: 'top-1/2 left-full ml-2 -translate-y-1/2',
  top: 'bottom-full left-1/2 mb-1.5 -translate-x-1/2',
  'top-end': 'right-0 bottom-full mb-1.5',
  'bottom-end': 'top-full right-0 mt-2',
} as const

/**
 * Balão da dica: aparece no hover (com um respiro de 300 ms) e no foco por teclado. É só visual
 * (`aria-hidden`): o nome acessível do elemento já vem do texto, do `aria-label` ou do `alt`.
 */
export function TooltipBubble({ label, side = 'right' }: { label: string; side?: keyof typeof sides }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute z-50 rounded-md bg-foreground px-2.5 py-1.5 text-xs leading-none font-semibold whitespace-nowrap text-card opacity-0 shadow-pop transition-opacity duration-100 ease-out',
        'group-hover/tip:opacity-100 group-hover/tip:delay-300 group-focus-visible/tip:opacity-100',
        sides[side],
      )}
    >
      {label}
    </span>
  )
}

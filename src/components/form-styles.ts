import { cn } from '@/lib/utils'

/** Campo de formulário: placa branca, régua de 1px com contraste 3:1, foco no azul da Linha 1. */
export const controlClass =
  'h-11 w-full rounded-sm border border-input bg-card px-3 text-base text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-[3px] focus-visible:outline-offset-0 focus-visible:outline-ring/40 aria-invalid:border-destructive disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70'

export const textareaClass = cn(controlClass, 'h-auto min-h-28 py-2')

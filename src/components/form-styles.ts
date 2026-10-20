import { cn } from '@/lib/utils'

/** Campo de formulário: fundo branco, borda de 1px com contraste 3:1, foco no azul primário. */
export const controlClass =
  'h-11 w-full rounded-md border border-input bg-card px-3 text-base text-foreground lg:h-9 lg:text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-[3px] focus-visible:outline-offset-0 focus-visible:outline-ring/40 aria-invalid:border-destructive disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70'

export const textareaClass = cn(controlClass, 'h-auto min-h-28 py-2')

import { cn } from '@/lib/utils'

export const controlClass =
  'h-11 w-full rounded-md border border-input bg-card px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 aria-invalid:border-destructive disabled:cursor-not-allowed disabled:opacity-60'

export const textareaClass = cn(controlClass, 'h-auto min-h-28 py-2')

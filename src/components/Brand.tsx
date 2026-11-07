import icon32 from '@/assets/brand/voltier-icon-32.webp'
import icon64 from '@/assets/brand/voltier-icon-64.webp'
import icon96 from '@/assets/brand/voltier-icon-96.webp'
import logo36 from '@/assets/brand/voltier-logo-36.webp'
import logo72 from '@/assets/brand/voltier-logo-72.webp'
import logo108 from '@/assets/brand/voltier-logo-108.webp'
import logo44 from '@/assets/brand/voltier-logo-44.webp'
import logo88 from '@/assets/brand/voltier-logo-88.webp'
import logo132 from '@/assets/brand/voltier-logo-132.webp'
import { cn } from '@/lib/utils'

// Cada tamanho é renderizado pronto (múltiplos exatos 1x/2x/3x, ver scripts/build-brand-assets.py): o
// navegador escolhe pelo `srcset` e nunca precisa reduzir a imagem, que é o que deixava a marca borrada.

/** Ícone da Voltier (32 px). `alt=""` quando o nome já aparece ao lado. */
export function BrandMark({ alt = 'Voltier', className }: { alt?: string; className?: string }) {
  return (
    <img
      src={icon64}
      srcSet={`${icon32} 1x, ${icon64} 2x, ${icon96} 3x`}
      alt={alt}
      width={32}
      height={32}
      className={cn('size-8 shrink-0 object-contain', className)}
    />
  )
}

const logos = {
  md: { height: 36, width: 125, srcSet: `${logo36} 1x, ${logo72} 2x, ${logo108} 3x`, src: logo72, className: 'h-9' },
  lg: { height: 44, width: 153, srcSet: `${logo44} 1x, ${logo88} 2x, ${logo132} 3x`, src: logo88, className: 'h-11' },
} as const

/** Marca com o nome (fundo claro): 36 px no menu e no login do celular, 44 px no painel do login. */
export function BrandLogo({ size = 'md', alt = 'Voltier', className }: { size?: keyof typeof logos; alt?: string; className?: string }) {
  const l = logos[size]
  return (
    <img
      src={l.src}
      srcSet={l.srcSet}
      alt={alt}
      width={l.width}
      height={l.height}
      className={cn(l.className, 'w-auto max-w-full object-contain object-left', className)}
    />
  )
}

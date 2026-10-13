import { Fragment, type ReactNode } from 'react'
import { LoadingState } from '@/components/states'
import { useAuth } from '@/features/auth/auth-context'
import { setActiveTimezone } from '@/lib/format'
import { useUserPreferences } from './api'

/**
 * Define o fuso de trabalho antes de renderizar as telas e remonta a árvore quando ele muda,
 * para que datas, janelas de consulta e formulários sejam recalculados no novo fuso.
 * Sem preferência (ou com erro), vale o fuso do navegador.
 */
export function TimezoneBoundary({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const prefs = useUserPreferences(session?.user.id)
  if (prefs.isPending && prefs.fetchStatus !== 'idle') return <LoadingState />
  const tz = prefs.data?.timezone ?? null
  setActiveTimezone(tz)
  return <Fragment key={tz ?? 'browser'}>{children}</Fragment>
}

import { useSyncExternalStore } from 'react'

/** Observa uma media query; sem `matchMedia` (testes/SSR) devolve `fallback`. */
export function useMediaQuery(query: string, fallback = false) {
  return useSyncExternalStore(
    (notify) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {}
      const mq = window.matchMedia(query)
      mq.addEventListener('change', notify)
      return () => mq.removeEventListener('change', notify)
    },
    () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : fallback),
    () => fallback,
  )
}

/** Desktop = a partir de 1024px (mesmo ponto do menu lateral): onde registros abrem em painel. */
export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)')

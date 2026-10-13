import { createContext, useContext } from 'react'

export type OverlayContextValue = {
  /** id do título do painel (aria-labelledby do diálogo). */
  titleId: string
  expanded: boolean
}

/** Presente só quando a tela de registro está sendo exibida dentro do painel (desktop). */
export const OverlayContext = createContext<OverlayContextValue | null>(null)

export const useOverlay = () => useContext(OverlayContext)

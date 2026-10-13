/**
 * Cores de linha (mundo "Linhas do Metrô"): cada projeto recebe uma linha estável, derivada do id,
 * como as linhas do metrô. Vermelho fica fora da paleta: é reservado para "agora" e atraso.
 * `ink` é a cor do texto sobre a linha (contraste AA conferido em 12px bold).
 * `outline` marca cores claras demais para o fundo (amarela): ganham contorno em tinta.
 */
export type Line = { key: string; name: string; color: string; ink: string; outline?: boolean }

export const LINES: readonly Line[] = [
  { key: 'azul', name: 'Azul', color: '#0455a1', ink: '#ffffff' },
  { key: 'verde', name: 'Verde', color: '#007e5e', ink: '#ffffff' },
  { key: 'amarela', name: 'Amarela', color: '#ffd400', ink: '#111418', outline: true },
  { key: 'lilas', name: 'Lilás', color: '#9b3894', ink: '#ffffff' },
  { key: 'rubi', name: 'Rubi', color: '#ca016b', ink: '#ffffff' },
  { key: 'turquesa', name: 'Turquesa', color: '#047fa3', ink: '#ffffff' },
  { key: 'ouro', name: 'Ouro', color: '#946616', ink: '#ffffff' },
]

/** Sem projeto: a linha Prata, neutra. */
export const NO_LINE: Line = { key: 'prata', name: 'Prata', color: '#68717a', ink: '#ffffff' }

/** FNV-1a de 32 bits: estável entre sessões e navegadores. */
function hash(text: string) {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

// Registro de linhas: projetos recebem linhas na ordem de criação, sem colisão até o 7º projeto
// (depois o ciclo recomeça). O LineRegistry carrega a ordem uma vez por sessão; sem ele, o hash
// estável do id é o fallback (testes, telas fora do shell).
let order = new Map<string, number>()

export function setProjectOrder(ids: readonly string[]) {
  order = new Map(ids.map((id, i) => [id, i]))
}

export function lineFor(projectId: string | null | undefined): Line {
  if (!projectId) return NO_LINE
  const i = order.get(projectId)
  return LINES[(i ?? hash(projectId)) % LINES.length]
}

/** Inicial do selo: primeira letra ou dígito do nome. */
export function lineInitial(name: string | null | undefined) {
  const m = (name ?? '').trim().match(/[\p{L}\p{N}]/u)
  return m ? m[0].toLocaleUpperCase('pt-BR') : '—'
}

/** Parâmetros de URL que pré-selecionam projeto/cliente no formulário de novo evento. */
export function newEventHref(kind: 'event' | 'meeting', link: { projectId?: string; clientId?: string }) {
  const p = new URLSearchParams()
  if (kind === 'meeting') p.set('tipo', 'reuniao')
  if (link.projectId) p.set('projeto', link.projectId)
  if (link.clientId) p.set('cliente', link.clientId)
  const qs = p.toString()
  return `/app/agenda/novo${qs ? `?${qs}` : ''}`
}

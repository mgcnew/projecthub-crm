/**
 * Rotas de registro (detalhe/criação) que no desktop abrem em painel por cima da página de origem.
 * `fallback` é a página usada como fundo quando a URL é aberta direto (F5, link colado).
 */
export type EntityRoute = {
  kind: 'task' | 'project' | 'client' | 'event' | 'meeting' | 'access' | 'lead' | 'new-project' | 'new-client' | 'new-event' | 'new-access' | 'new-lead'
  fallback: string
}

const rules: { re: RegExp; route: EntityRoute }[] = [
  { re: /^\/app\/projetos\/novo\/?$/, route: { kind: 'new-project', fallback: '/app/projetos' } },
  { re: /^\/app\/clientes\/novo\/?$/, route: { kind: 'new-client', fallback: '/app/clientes' } },
  { re: /^\/app\/prospeccao\/leads\/novo\/?$/, route: { kind: 'new-lead', fallback: '/app/prospeccao' } },
  { re: /^\/app\/acessos\/novo\/?$/, route: { kind: 'new-access', fallback: '/app/acessos' } },
  { re: /^\/app\/agenda\/novo\/?$/, route: { kind: 'new-event', fallback: '/app/agenda' } },
  { re: /^\/app\/tarefas\/(?!modelos\/?$)[^/]+\/?$/, route: { kind: 'task', fallback: '/app/tarefas' } },
  { re: /^\/app\/projetos\/[^/]+\/?$/, route: { kind: 'project', fallback: '/app/projetos' } },
  { re: /^\/app\/clientes\/[^/]+\/?$/, route: { kind: 'client', fallback: '/app/clientes' } },
  { re: /^\/app\/agenda\/[^/]+\/?$/, route: { kind: 'event', fallback: '/app/agenda' } },
  { re: /^\/app\/reunioes\/[^/]+\/?$/, route: { kind: 'meeting', fallback: '/app/reunioes' } },
  { re: /^\/app\/acessos\/[^/]+\/?$/, route: { kind: 'access', fallback: '/app/acessos' } },
  { re: /^\/app\/prospeccao\/leads\/[^/]+\/?$/, route: { kind: 'lead', fallback: '/app/prospeccao' } },
]

export function matchEntityRoute(pathname: string): EntityRoute | null {
  return rules.find((r) => r.re.test(pathname))?.route ?? null
}

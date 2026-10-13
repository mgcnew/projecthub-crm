import { describe, expect, it } from 'vitest'
import { matchEntityRoute } from './entityRoutes'

describe('matchEntityRoute', () => {
  it('reconhece detalhes e criações', () => {
    expect(matchEntityRoute('/app/tarefas/abc')).toEqual({ kind: 'task', fallback: '/app/tarefas' })
    expect(matchEntityRoute('/app/projetos/abc')?.kind).toBe('project')
    expect(matchEntityRoute('/app/clientes/abc')?.kind).toBe('client')
    expect(matchEntityRoute('/app/agenda/abc')?.kind).toBe('event')
    expect(matchEntityRoute('/app/reunioes/abc')).toEqual({ kind: 'meeting', fallback: '/app/reunioes' })
    expect(matchEntityRoute('/app/clientes/novo')?.kind).toBe('new-client')
    expect(matchEntityRoute('/app/projetos/novo')?.kind).toBe('new-project')
    expect(matchEntityRoute('/app/agenda/novo')?.kind).toBe('new-event')
  })

  it('páginas e listas não são registros', () => {
    for (const p of ['/app', '/app/meu-dia', '/app/tarefas', '/app/tarefas/modelos', '/app/clientes', '/app/projetos', '/app/agenda', '/app/reunioes', '/app/notificacoes', '/app/configuracoes', '/login'])
      expect(matchEntityRoute(p)).toBeNull()
  })

  it('aceita barra final e ignora subcaminhos desconhecidos', () => {
    expect(matchEntityRoute('/app/tarefas/abc/')?.kind).toBe('task')
    expect(matchEntityRoute('/app/tarefas/abc/extra')).toBeNull()
  })
})

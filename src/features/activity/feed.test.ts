import { describe, expect, it } from 'vitest'
import { entityHref, entityLabel, relativeTime } from './feed'

describe('feed de atividade', () => {
  it('destino por tipo de entidade (reunião abre a tela da reunião)', () => {
    expect(entityHref('task', 't1')).toBe('/app/tarefas/t1')
    expect(entityHref('project', 'p1')).toBe('/app/projetos/p1')
    expect(entityHref('client', 'c1')).toBe('/app/clientes/c1')
    expect(entityHref('calendar_event', 'e1', 'meeting')).toBe('/app/reunioes/e1')
    expect(entityHref('calendar_event', 'e1', 'event')).toBe('/app/agenda/e1')
  })

  it('rótulo da entidade', () => {
    expect(entityLabel('task')).toBe('Tarefa')
    expect(entityLabel('calendar_event', 'meeting')).toBe('Reunião')
  })

  it('tempo relativo', () => {
    const now = new Date('2026-10-13T12:00:00Z')
    expect(relativeTime('2026-10-13T11:59:40Z', now)).toBe('agora')
    expect(relativeTime('2026-10-13T11:55:00Z', now)).toBe('há 5 min')
    expect(relativeTime('2026-10-13T09:00:00Z', now)).toBe('há 3 h')
    expect(relativeTime('2026-10-12T10:00:00Z', now)).toBe('ontem')
    expect(relativeTime('2026-10-10T10:00:00Z', now)).toMatch(/^10\/10$/)
  })
})

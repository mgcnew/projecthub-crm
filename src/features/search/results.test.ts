import { describe, expect, it } from 'vitest'
import { buildGroups, flattenHits } from './results'

describe('buildGroups', () => {
  const raw = {
    tasks: [{ id: 't1', title: 'Enviar proposta', status: 'in_progress' }],
    projects: [{ id: 'p1', name: 'Site novo', status: 'active' }],
    clients: [
      { id: 'c1', name: 'Acme', company_name: 'Acme Ltda' },
      { id: 'c2', name: 'Beta', company_name: null },
    ],
    events: [
      { id: 'e1', title: 'Alinhamento', event_type: 'meeting', starts_at: '2030-05-06T13:00:00Z' },
      { id: 'e2', title: 'Pagamento', event_type: 'event', starts_at: '2030-05-07T13:00:00Z' },
    ],
  }

  it('agrupa na ordem tarefas, projetos, clientes, eventos e monta o destino de cada tipo', () => {
    const groups = buildGroups(raw)
    expect(groups.map((g) => g.id)).toEqual(['tasks', 'projects', 'clients', 'events'])
    const hrefs = flattenHits(groups).map((h) => h.href)
    expect(hrefs).toEqual([
      '/app/tarefas/t1',
      '/app/projetos/p1',
      '/app/clientes/c1',
      '/app/clientes/c2',
      '/app/reunioes/e1',
      '/app/agenda/e2',
    ])
  })

  it('legendas legíveis e chaves únicas entre tipos', () => {
    const hits = flattenHits(buildGroups(raw))
    expect(hits[0].subtitle).toBe('Em andamento')
    expect(hits[1].subtitle).toBe('Em andamento')
    expect(hits[2].subtitle).toBe('Acme Ltda')
    expect(hits[3].subtitle).toBe('Cliente')
    expect(hits[4].subtitle).toMatch(/^Reunião · /)
    expect(hits[5].subtitle).toMatch(/^Evento · /)
    expect(new Set(hits.map((h) => h.key)).size).toBe(hits.length)
  })

  it('omite grupos vazios', () => {
    expect(buildGroups({ tasks: [], projects: [], clients: [], events: [] })).toEqual([])
    expect(buildGroups({ ...raw, tasks: [], events: [] }).map((g) => g.id)).toEqual(['projects', 'clients'])
  })
})

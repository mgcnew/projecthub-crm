import { groupByProject } from './group'

const row = (name: string, project_id: string | null, project?: string) => ({
  name,
  project_id,
  projects: project ? { name: project } : null,
})

describe('groupByProject', () => {
  it('agrupa por projeto, em ordem alfabética, com "Sem projeto" por último', () => {
    const groups = groupByProject([
      row('Email', null),
      row('Vercel', 'p2', 'Site'),
      row('GitHub', 'p1', 'App Pizzaria'),
      row('Supabase', 'p1', 'App Pizzaria'),
    ])
    expect(groups.map((g) => g.name)).toEqual(['App Pizzaria', 'Site', 'Sem projeto'])
    expect(groups[0].rows.map((r) => r.name)).toEqual(['GitHub', 'Supabase'])
    expect(groups[2].projectId).toBeNull()
  })
  it('lista vazia não gera grupos', () => {
    expect(groupByProject([])).toEqual([])
  })
})

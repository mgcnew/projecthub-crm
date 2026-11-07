export type AccessGroup<T> = { key: string; projectId: string | null; name: string; rows: T[] }

/**
 * Agrupa os acessos por projeto: grupos em ordem alfabética, "Sem projeto" por último; dentro de cada
 * grupo vale a ordem recebida (o servidor já ordena pelo nome do serviço).
 */
export function groupByProject<T extends { project_id: string | null; projects: { name: string } | null }>(
  rows: T[],
): AccessGroup<T>[] {
  const map = new Map<string, AccessGroup<T>>()
  for (const r of rows) {
    const key = r.project_id ?? 'sem-projeto'
    let g = map.get(key)
    if (!g) {
      g = { key, projectId: r.project_id, name: r.projects?.name ?? 'Sem projeto', rows: [] }
      map.set(key, g)
    }
    g.rows.push(r)
  }
  return [...map.values()].sort((a, b) => {
    if (a.projectId === null) return 1
    if (b.projectId === null) return -1
    return a.name.localeCompare(b.name, 'pt-BR')
  })
}

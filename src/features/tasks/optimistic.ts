/**
 * Aplica `status` a toda tarefa `id` encontrada em qualquer formato de cache (lista paginada,
 * painel da Central do dia, planos do dia, vínculos…): percorre objetos e arrays e troca o status
 * de cada objeto com `id` igual e campo `status`. Devolve a mesma referência quando nada muda.
 */
export function patchTaskStatus<T>(data: T, id: string, status: string): T {
  if (Array.isArray(data)) {
    let changed = false
    const next = data.map((item) => {
      const patched = patchTaskStatus(item, id, status)
      if (patched !== item) changed = true
      return patched
    })
    return (changed ? next : data) as T
  }
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>
    let changed = false
    const next: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(obj)) {
      const patched = patchTaskStatus(v, id, status)
      if (patched !== v) changed = true
      next[k] = patched
    }
    if (obj.id === id && 'status' in obj && obj.status !== status) {
      next.status = status
      changed = true
    }
    return (changed ? next : data) as T
  }
  return data
}

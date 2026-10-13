export type NamedOption = { id: string; name: string }

/**
 * Lista de opções de um <select> que SEMPRE contém a opção do valor atual, com a mesma `key`
 * (o id) antes, durante e depois do carregamento. Assim o React reaproveita o mesmo <option> e o
 * navegador não perde a seleção quando a lista chega (bug: o select voltava para "Sem …").
 * Se o valor atual não estiver na lista (ex.: cliente arquivado) ele aparece com `missingLabel`.
 */
export function withCurrentOption(
  options: NamedOption[] | undefined,
  currentId: string,
  loading: boolean,
  missingLabel: string,
): NamedOption[] {
  const list = options ?? []
  if (!currentId || list.some((o) => o.id === currentId)) return list
  return [{ id: currentId, name: loading ? 'Carregando…' : missingLabel }, ...list]
}

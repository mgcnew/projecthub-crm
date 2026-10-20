import { Search } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SEARCH_MIN_CHARS, useGlobalSearch } from './api'
import { flattenHits } from './results'

/** Valor com atraso: a consulta só dispara quando a digitação dá uma pausa. */
function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

/**
 * Busca global (Ctrl/Cmd+K). <dialog> modal nativo (a CSP estrita não admite libs que injetam <style>);
 * o conteúdo é o painel abaixo, montado só enquanto aberto, então termo e item ativo recomeçam a cada uso.
 */
export function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-label="Buscar"
      // Esc: o estado `open` é a fonte da verdade, então o fechamento nativo é delegado.
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      // Clique no fundo (o próprio <dialog>, fora do conteúdo) fecha.
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
      className="mx-auto mt-[10vh] w-[min(38rem,calc(100vw-1.5rem))] rounded-xl border border-border bg-card p-0 text-card-foreground shadow-pop backdrop:bg-foreground/45"
    >
      {open && <SearchPanel onClose={onClose} />}
    </dialog>
  )
}

/** Padrão combobox + listbox: o foco fica no campo e `aria-activedescendant` indica a opção ativa. */
function SearchPanel({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const listId = useId()
  const [term, setTerm] = useState('')
  const [active, setActive] = useState(0)
  const debounced = useDebounced(term, 220)
  const typed = term.trim().length >= SEARCH_MIN_CHARS
  const search = useGlobalSearch(debounced)

  const groups = useMemo(() => (typed ? (search.data ?? []) : []), [typed, search.data])
  const hits = useMemo(() => flattenHits(groups), [groups])
  const settled = typed && debounced.trim() === term.trim() && !search.isFetching

  const activeIndex = Math.min(active, Math.max(hits.length - 1, 0))
  const optionId = (i: number) => `${listId}-opt-${i}`

  // Posição global de cada grupo (para os ids das opções), sem mutar variável durante a renderização.
  const starts = groups.map((_, gi) => groups.slice(0, gi).reduce((n, g) => n + g.hits.length, 0))

  const status = !typed
    ? ''
    : search.isError
      ? 'Não foi possível buscar agora.'
      : !settled
        ? 'Buscando…'
        : hits.length === 0
          ? 'Nenhum resultado.'
          : `${hits.length} resultado${hits.length > 1 ? 's' : ''}.`

  const choose = (index: number) => {
    const hit = hits[index]
    if (!hit) return
    onClose()
    navigate(hit.href)
  }

  return (
    <>
      <div className="flex items-center gap-3 border-b border-border px-4">
        <Search aria-hidden="true" className="size-5 shrink-0" />
        <input
          role="combobox"
          aria-expanded={hits.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={hits.length > 0 ? optionId(activeIndex) : undefined}
          aria-label="Buscar tarefas, projetos, clientes e reuniões"
          placeholder="Buscar tarefas, projetos, clientes e reuniões"
          autoComplete="off"
          spellCheck={false}
          autoFocus
          value={term}
          onChange={(e) => {
            setTerm(e.target.value)
            setActive(0)
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' && hits.length > 0) {
              e.preventDefault()
              setActive((activeIndex + 1) % hits.length)
            } else if (e.key === 'ArrowUp' && hits.length > 0) {
              e.preventDefault()
              setActive((activeIndex - 1 + hits.length) % hits.length)
            } else if (e.key === 'Enter') {
              e.preventDefault()
              choose(activeIndex)
            }
          }}
          className="h-14 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
        />
        <kbd className="hidden shrink-0 rounded-sm border border-border px-1.5 py-0.5 text-xs font-semibold text-muted-foreground sm:block">
          Esc
        </kbd>
      </div>

      <p role="status" className="sr-only">
        {status}
      </p>

      <div id={listId} role="listbox" aria-label="Resultados" className="max-h-[min(26rem,60vh)] overflow-y-auto pb-2">
        {!typed && (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            Digite pelo menos {SEARCH_MIN_CHARS} letras. A busca vale para tarefas, projetos, clientes, reuniões e
            eventos.
          </p>
        )}
        {typed && search.isError && (
          <p className="px-4 py-6 text-sm text-destructive">Não foi possível buscar agora. Tente de novo.</p>
        )}
        {typed && settled && !search.isError && hits.length === 0 && (
          <p className="px-4 py-6 text-sm text-muted-foreground">Nenhum resultado para “{term.trim()}”.</p>
        )}
        {groups.map((g, gi) => (
          <div key={g.id} role="group" aria-labelledby={`${listId}-${g.id}`}>
            <p id={`${listId}-${g.id}`} className="section-title border-t border-border px-4 pt-3 pb-1 first:border-t-0">
              {g.label}
            </p>
            {g.hits.map((h, hi) => {
              const i = starts[gi] + hi
              const isActive = i === activeIndex
              return (
                <div
                  key={h.key}
                  id={optionId(i)}
                  role="option"
                  aria-selected={isActive}
                  onMouseMove={() => setActive(i)}
                  onClick={() => choose(i)}
                  className={
                    'mx-2 flex min-h-12 cursor-pointer items-baseline gap-3 rounded-md px-3 py-2 ' +
                    (isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')
                  }
                >
                  <span className="min-w-0 flex-1 truncate font-semibold">{h.title}</span>
                  <span className={'shrink-0 text-xs ' + (isActive ? 'text-primary-foreground' : 'text-muted-foreground')}>
                    {h.subtitle}
                  </span>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </>
  )
}

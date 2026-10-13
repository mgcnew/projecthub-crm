import { useCallback, useState } from 'react'

/**
 * Estado que sobrevive entre visitas (localStorage). Conveniência por navegador, nunca dado de negócio:
 * leitura/gravação protegidas e o valor lido passa por `validate`, então um valor antigo ou corrompido
 * cai no padrão em vez de quebrar a tela.
 */
export function usePersistedState<T>(
  key: string,
  initial: T,
  validate: (value: unknown) => T | null,
): [T, (next: T | ((prev: T) => T)) => void, () => void] {
  const [state, setState] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      if (raw === null) return initial
      return validate(JSON.parse(raw)) ?? initial
    } catch {
      return initial
    }
  })

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setState((prev) => {
        const value = typeof next === 'function' ? (next as (p: T) => T)(prev) : next
        try {
          localStorage.setItem(key, JSON.stringify(value))
        } catch {
          // sem armazenamento: o estado vale só nesta sessão
        }
        return value
      })
    },
    [key],
  )

  const reset = useCallback(() => {
    try {
      localStorage.removeItem(key)
    } catch {
      // ignora
    }
    setState(initial)
  }, [key, initial])

  return [state, set, reset]
}

/** Validador de objeto plano: mantém só as chaves esperadas, cada uma validada; chave inválida usa o padrão. */
export function objectValidator<T extends Record<string, unknown>>(
  defaults: T,
  rules: { [K in keyof T]: (v: unknown) => v is T[K] },
) {
  return (value: unknown): T | null => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
    const src = value as Record<string, unknown>
    const out = { ...defaults }
    for (const k of Object.keys(defaults) as (keyof T)[]) {
      if (k in src && rules[k](src[k as string])) out[k] = src[k as string] as T[typeof k]
    }
    return out
  }
}

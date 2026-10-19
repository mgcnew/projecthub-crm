// "Lembrar de mim" (D103). A senha NUNCA é guardada; só o e-mail e a escolha do usuário.
//  - lembrar (padrão): a sessão do Supabase fica em localStorage e sobrevive ao fechar o navegador;
//  - não lembrar: a sessão fica em sessionStorage, vale só para a aba e some ao fechá-la.
const REMEMBER_KEY = 'projecthub:remember'
const EMAIL_KEY = 'projecthub:remembered-email'

/** Storage pode lançar (modo privado, dados bloqueados): nada aqui pode derrubar o login. */
function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn()
  } catch {
    return fallback
  }
}

export const getRemember = () => safe(() => localStorage.getItem(REMEMBER_KEY) !== '0', true)
export const setRemember = (remember: boolean) => safe(() => localStorage.setItem(REMEMBER_KEY, remember ? '1' : '0'), undefined)

export const getRememberedEmail = () => safe(() => localStorage.getItem(EMAIL_KEY) ?? '', '')

/** Guarda o e-mail para pré-preencher o próximo login; `null` esquece. */
export function saveRememberedEmail(email: string | null) {
  safe(() => {
    if (email) localStorage.setItem(EMAIL_KEY, email)
    else localStorage.removeItem(EMAIL_KEY)
  }, undefined)
}

/** Storage do cliente do Supabase: escolhe onde gravar a sessão conforme "lembrar de mim". */
export const authStorage = {
  getItem: (key: string) => safe(() => sessionStorage.getItem(key), null) ?? safe(() => localStorage.getItem(key), null),
  setItem: (key: string, value: string) => {
    const [target, other] = getRemember() ? [localStorage, sessionStorage] : [sessionStorage, localStorage]
    safe(() => target.setItem(key, value), undefined)
    // A sessão vive em um lugar só: evita uma cópia antiga ressuscitar depois de mudar a escolha.
    safe(() => other.removeItem(key), undefined)
  },
  removeItem: (key: string) => {
    safe(() => sessionStorage.removeItem(key), undefined)
    safe(() => localStorage.removeItem(key), undefined)
  },
}

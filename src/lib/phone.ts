const valid = (digits: string) => /^[1-9]\d{7,14}$/.test(digits)

/**
 * Telefone digitado → E.164 (`+5511912345678`) ou null. Sem DDI, 10 ou 11 dígitos são um número brasileiro
 * com DDD (ganha +55); zeros de tronco (011…) são removidos. Com `+` ou `00`, o DDI vem no próprio número.
 */
export function normalizePhone(input: string, defaultCountry = '55'): string | null {
  const raw = input.trim()
  if (!raw) return null
  let digits = raw.replace(/\D/g, '')
  if (raw.startsWith('+')) return valid(digits) ? `+${digits}` : null
  if (digits.startsWith('00')) {
    digits = digits.slice(2)
    return valid(digits) ? `+${digits}` : null
  }
  digits = digits.replace(/^0+/, '')
  if (digits.startsWith(defaultCountry) && (digits.length === 12 || digits.length === 13)) return `+${digits}`
  if (digits.length === 10 || digits.length === 11) return `+${defaultCountry}${digits}`
  return null
}

/** E.164 → texto legível: brasileiro vira (11) 91234-5678; outros ficam como estão. */
export function formatPhone(e164: string | null | undefined) {
  if (!e164) return ''
  const m = /^\+55(\d{2})(\d{4,5})(\d{4})$/.exec(e164)
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164
}

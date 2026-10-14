export const digitsOnly = (v: string) => v.replace(/\D/g, '')

function checkDigit(nums: number[], weights: number[]) {
  const sum = nums.reduce((n, d, i) => n + d * weights[i], 0)
  const r = (sum * 10) % 11
  return r === 10 ? 0 : r
}

export function isValidCpf(value: string) {
  const d = digitsOnly(value)
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false
  const n = d.split('').map(Number)
  const d1 = checkDigit(n.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2])
  const d2 = checkDigit(n.slice(0, 10), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2])
  return d1 === n[9] && d2 === n[10]
}

export function isValidCnpj(value: string) {
  const d = digitsOnly(value)
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false
  const n = d.split('').map(Number)
  const d1 = checkDigit(n.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  const d2 = checkDigit(n.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  return d1 === n[12] && d2 === n[13]
}

/** Aceita CPF ou CNPJ, com ou sem pontuação, e confere os dígitos verificadores. */
export const isValidTaxId = (v: string) => isValidCpf(v) || isValidCnpj(v)

/** 11 dígitos → 000.000.000-00; 14 → 00.000.000/0000-00; qualquer outra coisa volta como veio. */
export function formatTaxId(value: string) {
  const d = digitsOnly(value)
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
  return value.trim()
}

/** Link do WhatsApp (wa.me) a partir de um telefone; números brasileiros sem DDI ganham o 55. */
export function whatsappUrl(phone: string): string | null {
  const d = digitsOnly(phone)
  if (d.length < 10) return null
  // Com "+" o número já traz o DDI; sem ele, 10 ou 11 dígitos são um número brasileiro com DDD.
  const international = phone.trim().startsWith('+')
  const full = !international && d.length <= 11 ? `55${d}` : d
  return `https://wa.me/${full}`
}

export function telUrl(phone: string): string | null {
  const d = phone.replace(/[^\d+]/g, '')
  return d.replace(/\D/g, '').length >= 8 ? `tel:${d}` : null
}

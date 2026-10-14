export const currencyLabels = { BRL: 'Real (R$)', USD: 'Dólar (US$)', EUR: 'Euro (€)' } as const
export type Currency = keyof typeof currencyLabels

/** Valor em centavos inteiros → "R$ 1.500,00". Nunca recebe decimal: dinheiro é inteiro em toda a pilha. */
export function formatMoney(cents: number, currency: string = 'BRL') {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(cents / 100)
}

/** Centavos → texto editável "1500,00" (sem símbolo nem separador de milhar). */
export function formatMoneyInput(cents: number | null | undefined) {
  if (cents === null || cents === undefined) return ''
  const whole = Math.trunc(cents / 100)
  const frac = String(Math.abs(cents % 100)).padStart(2, '0')
  return `${whole},${frac}`
}

/**
 * Texto digitado → centavos inteiros, ou null se vazio/inválido. Aceita "1.500,00", "1500,5", "1500.50",
 * "R$ 1.500" e "1,500.00". Mais de 2 casas decimais é inválido (nada de arredondar dinheiro em silêncio).
 */
export function parseMoney(input: string): number | null {
  if (input.includes('-')) return null // valor negativo nunca é aceito
  const s = input.replace(/[^\d.,]/g, '')
  if (!s || !/\d/.test(s)) return null

  const lastDot = s.lastIndexOf('.')
  const lastComma = s.lastIndexOf(',')
  let intPart: string
  let fracPart = ''

  if (lastDot >= 0 && lastComma >= 0) {
    const sep = Math.max(lastDot, lastComma)
    intPart = s.slice(0, sep).replace(/[.,]/g, '')
    fracPart = s.slice(sep + 1)
  } else if (lastComma >= 0 || lastDot >= 0) {
    const sep = Math.max(lastDot, lastComma)
    const sepChar = s[sep]
    const after = s.slice(sep + 1)
    const repeated = s.split(sepChar).length > 2
    // "1.500" (um ponto seguido de 3 dígitos) é milhar; "1500,50" e "1500.5" são decimais.
    if (repeated || (sepChar === '.' && after.length === 3)) {
      intPart = s.replace(/[.,]/g, '')
    } else {
      intPart = s.slice(0, sep)
      fracPart = after
    }
  } else {
    intPart = s
  }

  if (!/^\d*$/.test(intPart) || !/^\d*$/.test(fracPart) || fracPart.length > 2) return null
  const cents = Number(intPart || '0') * 100 + Number((fracPart + '00').slice(0, 2))
  return Number.isSafeInteger(cents) ? cents : null
}

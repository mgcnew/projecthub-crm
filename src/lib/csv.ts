/**
 * Leitor de CSV próprio (sem biblioteca): aspas com aspas escapadas (""), quebra de linha dentro de aspas,
 * CRLF, BOM e separador `,`, `;` ou tabulação. Planilhas do Excel em pt-BR costumam vir com `;` e em
 * Windows-1252; `decodeCsv` cai para essa codificação quando o arquivo não é UTF-8 válido.
 */
export type Delimiter = ',' | ';' | '\t'

export function decodeCsv(buffer: ArrayBuffer): string {
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  } catch {
    text = new TextDecoder('windows-1252').decode(buffer)
  }
  return text.replace(/^\uFEFF/, '')
}

/** Separador mais frequente na primeira linha, contando só o que está fora de aspas. */
export function detectDelimiter(text: string): Delimiter {
  const counts: Record<Delimiter, number> = { ',': 0, ';': 0, '\t': 0 }
  let quoted = false
  for (const ch of text) {
    if (ch === '"') quoted = !quoted
    else if (!quoted && (ch === '\n' || ch === '\r')) break
    else if (!quoted && ch in counts) counts[ch as Delimiter] += 1
  }
  const [best, n] = (Object.entries(counts) as [Delimiter, number][]).sort((a, b) => b[1] - a[1])[0]
  return n > 0 ? best : ','
}

/** Linhas → células (sem espaços nas pontas). Linhas totalmente vazias são descartadas. */
export function parseCsv(text: string, delimiter: Delimiter = detectDelimiter(text)): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  const pushCell = () => {
    row.push(cell.trim())
    cell = ''
  }
  const pushRow = () => {
    pushCell()
    if (row.some((c) => c !== '')) rows.push(row)
    row = []
  }
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i += 1
        } else {
          quoted = false
        }
      } else {
        cell += ch
      }
    } else if (ch === '"') {
      quoted = true
    } else if (ch === delimiter) {
      pushCell()
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1
      pushRow()
    } else {
      cell += ch
    }
  }
  if (cell !== '' || row.length > 0) pushRow()
  return rows
}

// Caixa de e-mail local (Mailpit, porta 54324 do Supabase local): usada só em testes.
const base = process.env.MAIL_URL ?? 'http://127.0.0.1:54324'

/** Espera a mensagem mais recente para `to` e devolve o texto. */
export async function waitForMail(to: string, timeoutMs = 15_000): Promise<string> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const res = await fetch(`${base}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`)
    if (res.ok) {
      const body = (await res.json()) as { messages?: { ID: string }[] }
      const id = body.messages?.[0]?.ID
      if (id) {
        const msg = await fetch(`${base}/api/v1/message/${id}`)
        const data = (await msg.json()) as { Text?: string; HTML?: string }
        return `${data.Text ?? ''}\n${data.HTML ?? ''}`
      }
    }
    await new Promise((r) => setTimeout(r, 400))
  }
  throw new Error(`nenhum e-mail para ${to} em ${timeoutMs} ms`)
}

/** Primeiro link http(s) do e-mail que contém `needle`. */
export function linkIn(mail: string, needle: string): string {
  const m = mail.match(new RegExp(`https?://[^\\s"'<>]*${needle}[^\\s"'<>]*`))
  if (!m) throw new Error(`link com "${needle}" não encontrado no e-mail`)
  return m[0].replace(/&amp;/g, '&')
}

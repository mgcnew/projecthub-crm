import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildVercelConfig, DEFAULT_SUPABASE_ORIGIN } from '../../config/vercel-config'

describe('vercel.json', () => {
  const committed = JSON.parse(readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8'))

  it('está em dia com o gerador (rode `npm run deploy:config` ao mudar os cabeçalhos)', () => {
    // A origem do Supabase é a escolha do deploy; o resto precisa ser exatamente o que o gerador produz.
    const csp = JSON.stringify(committed).match(/connect-src 'self' ([^;"]+)/)![1]
    expect([DEFAULT_SUPABASE_ORIGIN, csp]).toContain(csp)
    expect(committed).toEqual(buildVercelConfig(csp))
  })

  it('reescreve rotas da SPA para o index.html e mantém os assets em cache imutável', () => {
    expect(committed.rewrites).toEqual([{ source: '/(.*)', destination: '/index.html' }])
    const assets = committed.headers.find((h: { source: string }) => h.source === '/assets/(.*)')
    expect(assets.headers[0].value).toContain('immutable')
    const html = committed.headers.find((h: { source: string }) => h.source === '/index.html')
    expect(html.headers[0].value).toBe('no-cache')
  })

  it('CSP estrita: sem unsafe-inline/unsafe-eval, sem framing, conexão só com o próprio domínio e o Supabase', () => {
    const all = committed.headers.find((h: { source: string }) => h.source === '/(.*)').headers as { key: string; value: string }[]
    const csp = all.find((h) => h.key === 'Content-Security-Policy')!.value
    expect(csp).not.toMatch(/unsafe-(inline|eval)/)
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toMatch(/connect-src 'self' https:\/\/(\*|[a-z0-9-]+)\.supabase\.co(;|$)/) // padrão ou origem exata
    for (const key of ['Strict-Transport-Security', 'X-Content-Type-Options', 'Referrer-Policy', 'X-Frame-Options', 'X-Robots-Tag'])
      expect(all.some((h) => h.key === key)).toBe(true)
  })

  it('aceita a origem exata do projeto (mais estrito)', () => {
    const exact = buildVercelConfig('https://abcd1234.supabase.co')
    const csp = JSON.stringify(exact)
    expect(csp).toContain("connect-src 'self' https://abcd1234.supabase.co")
    expect(csp).not.toContain('*.supabase.co')
  })
})

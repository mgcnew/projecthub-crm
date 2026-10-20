import { expect, test } from '@playwright/test'

// Roda contra o build de produção (vite preview, mesma CSP do deploy): o service worker só existe nele.
test('PWA: manifesto válido, service worker ativo sob CSP estrita e app abre sem rede', async ({ page, context }) => {
  const violations: string[] = []
  await page.exposeFunction('__reportCsp', (v: string) => violations.push(v))
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => {
      void (window as unknown as { __reportCsp: (v: string) => void }).__reportCsp(`${e.violatedDirective} ${e.blockedURI}`)
    })
  })

  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible()

  // Manifesto ligado no HTML, com o que o navegador exige para oferecer a instalação.
  const href = await page.locator('link[rel="manifest"]').getAttribute('href')
  expect(href).toBeTruthy()
  const res = await page.request.get(href!)
  expect(res.ok()).toBe(true)
  const manifest = await res.json()
  expect(manifest).toMatchObject({ display: 'standalone', start_url: '/app', lang: 'pt-BR', theme_color: '#0455a1' })
  const icons = manifest.icons as { src: string; sizes: string; purpose: string }[]
  expect(icons.some((i) => i.sizes === '192x192')).toBe(true)
  expect(icons.some((i) => i.sizes === '512x512' && i.purpose === 'maskable')).toBe(true)
  for (const i of icons) expect((await page.request.get(i.src)).ok(), `ícone ${i.src}`).toBe(true)
  expect(await page.locator('link[rel="apple-touch-icon"]').getAttribute('href')).toBeTruthy()

  // Service worker registrado e ativo; sw.js e manifesto sempre revalidados.
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope)
  expect(scope).toContain('/')
  expect(violations).toEqual([])

  // Sem rede: a tela de login ainda abre a partir do cache do app.
  await page.reload() // já sob o controle do service worker
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible()
  await context.setOffline(false)

  // Dados nunca ficam em cache do service worker: só arquivos do próprio app.
  const cached = await page.evaluate(async () => {
    const urls: string[] = []
    for (const name of await caches.keys()) for (const r of await (await caches.open(name)).keys()) urls.push(r.url)
    return urls
  })
  expect(cached.length).toBeGreaterThan(0)
  const origin = new URL(page.url()).origin
  expect(cached.filter((u) => new URL(u).origin !== origin)).toEqual([])
  expect(cached.filter((u) => /supabase|\/rest\/v1|\/auth\/v1/.test(u))).toEqual([])
})

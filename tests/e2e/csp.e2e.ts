import { expect, test } from '@playwright/test'
import { apiSessionFor, createUser, login } from './helpers'

// Roda contra o build de produção (vite preview) com os cabeçalhos de config/security-headers.ts.
test('o build de produção funciona sob CSP estrita, sem violações', async ({ page }) => {
  const user = await createUser('csp')

  const violations: string[] = []
  const consoleErrors: string[] = []
  await page.exposeFunction('__reportCsp', (v: string) => violations.push(v))
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => {
      void (window as unknown as { __reportCsp: (v: string) => void }).__reportCsp(
        `${e.violatedDirective} ${e.blockedURI} ${e.sourceFile}:${e.lineNumber}`,
      )
    })
  })
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()))

  const response = await page.goto('/login')
  const h = response!.headers()
  const csp = h['content-security-policy']
  expect(csp).toContain("default-src 'self'")
  expect(csp).toContain("script-src 'self'")
  expect(csp).not.toContain("'unsafe-inline'")
  expect(csp).not.toContain("'unsafe-eval'")
  expect(csp).toContain("frame-ancestors 'none'")
  expect(csp).toContain("object-src 'none'")
  expect(csp).toContain("base-uri 'self'")
  expect(h['x-content-type-options']).toBe('nosniff')
  expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin')
  expect(h['x-frame-options']).toBe('DENY')

  await login(page, user)
  for (const [path, heading] of [
    ['/app/meu-dia', 'Meu dia'],
    ['/app/agenda/novo', 'Novo evento'],
    ['/app/tarefas', 'Tarefas'],
    ['/app/clientes/novo', 'Novo cliente'],
    ['/app/notificacoes', 'Notificações'],
    ['/app/configuracoes', 'Configurações'],
  ] as const) {
    await page.goto(path)
    // páginas têm h1; registros abrem em painel (diálogo) com h2
    await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible()
  }

  // Fluxo com escrita: o app continua funcional (fetch ao Supabase permitido pelo connect-src).
  await page.goto('/app/meu-dia')
  await page.getByLabel('Nova tarefa para este dia').fill('Tarefa sob CSP')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('checkbox', { name: 'Concluir Tarefa sob CSP' })).toBeVisible()

  // Diálogo de confirmação (<dialog> nativo): abre e fecha sob CSP sem violações.
  const { client, orgId } = await apiSessionFor(user)
  const c = await client.from('clients').insert({ organization_id: orgId, name: 'Cliente CSP' }).select('id').single()
  await page.goto(`/app/clientes/${c.data!.id}`)
  await page.getByRole('button', { name: 'Arquivar' }).click()
  await expect(page.getByRole('alertdialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('alertdialog')).toBeHidden()

  expect(violations, 'violações de CSP').toEqual([])
  expect(consoleErrors.filter((e) => /Content Security Policy|Refused to/i.test(e))).toEqual([])
})

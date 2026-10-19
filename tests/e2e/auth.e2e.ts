import { expect, test } from '@playwright/test'
import { createUser, login, type TestUser } from './helpers'

test.describe('autenticação', () => {
  let user: TestUser

  test.beforeAll(async () => {
    user = await createUser('auth')
  })

  test('visitante é enviado ao login ao abrir uma rota protegida', async ({ page }) => {
    await page.goto('/app/tarefas')
    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible()
  })

  test('mostrar e ocultar senha preserva o valor sem enviar o formulário', async ({ page }) => {
    await page.goto('/login')
    const password = page.getByLabel('Senha', { exact: true })
    await password.fill('senha-digitada-123')
    await page.getByRole('button', { name: 'Mostrar senha', exact: true }).click()
    await expect(password).toHaveAttribute('type', 'text')
    await expect(password).toHaveValue('senha-digitada-123')
    await page.getByRole('button', { name: 'Ocultar senha', exact: true }).click()
    await expect(password).toHaveAttribute('type', 'password')
    await expect(password).toHaveValue('senha-digitada-123')
    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByRole('alert')).toHaveCount(0)
  })

  test('senha incorreta mostra erro genérico e não entra', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('E-mail').fill(user.email)
    await page.getByLabel('Senha', { exact: true }).fill('senha-errada-123')
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page.getByRole('alert')).toHaveText('E-mail ou senha incorretos.')
    await expect(page).toHaveURL(/\/login/)
  })

  test('entra, mantém a sessão ao recarregar e sai', async ({ page }) => {
    await login(page, user)
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Central do dia' })).toBeVisible()

    await page.getByRole('button', { name: 'Sair' }).click()
    await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible()
    await page.goto('/app')
    await expect(page).toHaveURL(/\/login/)
  })

  test('lembrar de mim (padrão): sessão vale em outra aba e o e-mail volta preenchido', async ({ page, context }) => {
    await page.goto('/login')
    const remember = page.getByRole('checkbox', { name: 'Lembrar de mim neste dispositivo' })
    await expect(remember).toBeChecked()
    await login(page, user)

    // Outra aba do mesmo navegador já entra (sessão em localStorage).
    const other = await context.newPage()
    await other.goto('/app')
    await expect(other.getByRole('heading', { name: 'Central do dia' })).toBeVisible()
    await other.close()

    // Depois de sair, o e-mail volta no campo; a senha nunca.
    await page.getByRole('button', { name: 'Sair' }).click()
    await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible()
    await expect(page.getByLabel('E-mail')).toHaveValue(user.email)
    await expect(page.getByLabel('Senha', { exact: true })).toHaveValue('')
    const stored = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))
    expect(stored).not.toContain(user.password)
  })

  test('sem lembrar: a sessão fica só na aba e o e-mail não é guardado', async ({ page, context }) => {
    await page.goto('/login')
    await page.getByLabel('E-mail').fill(user.email)
    await page.getByLabel('Senha', { exact: true }).fill(user.password)
    await page.getByRole('checkbox', { name: 'Lembrar de mim neste dispositivo' }).uncheck()
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page.getByRole('heading', { name: 'Central do dia' })).toBeVisible()

    // Recarregar a mesma aba mantém a sessão (sessionStorage).
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Central do dia' })).toBeVisible()

    // Outra aba não herda a sessão.
    const other = await context.newPage()
    await other.goto('/app')
    await expect(other).toHaveURL(/\/login/)
    await other.close()

    // Sair: o e-mail não foi guardado e a escolha continua desmarcada.
    await page.getByRole('button', { name: 'Sair' }).click()
    await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible()
    await expect(page.getByLabel('E-mail')).toHaveValue('')
    await expect(page.getByRole('checkbox', { name: 'Lembrar de mim neste dispositivo' })).not.toBeChecked()
  })
})


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

  test('senha incorreta mostra erro genérico e não entra', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('E-mail').fill(user.email)
    await page.getByLabel('Senha').fill('senha-errada-123')
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
})

import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { linkIn, waitForMail } from '../support/mail'
import { totp } from '../support/totp'
import { createUser, enableMfa } from './helpers'

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']
const NEW_PASSWORD = 'Nova-Senha-Forte-42'

async function expectNoViolations(page: Page, label: string) {
  await page.waitForLoadState('networkidle')
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze()
  expect(
    results.violations.map((v) => ({ rule: v.id, nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) })),
    `violações de acessibilidade em ${label}`,
  ).toEqual([])
}

async function requestReset(page: Page, email: string) {
  await page.goto('/login')
  await page.getByRole('link', { name: 'Esqueci a senha' }).click()
  await expect(page.getByRole('heading', { name: 'Recuperar senha' })).toBeVisible()
  await page.getByLabel('E-mail').fill(email)
  await page.getByRole('button', { name: 'Enviar link' }).click()
  await expect(page.getByRole('status')).toContainText('Se esse e-mail tiver uma conta')
}

async function setNewPassword(page: Page) {
  await expect(page.getByRole('heading', { name: 'Nova senha' })).toBeVisible()
  await expectNoViolations(page, 'redefinir senha')

  await page.getByLabel('Nova senha', { exact: true }).fill('curta')
  await page.getByLabel('Repita a nova senha').fill('curta')
  await page.getByRole('button', { name: 'Salvar nova senha' }).click()
  await expect(page.getByText('Use pelo menos 12 caracteres')).toBeVisible()

  await page.getByLabel('Nova senha', { exact: true }).fill(NEW_PASSWORD)
  await page.getByLabel('Repita a nova senha').fill('Outra-Senha-Forte-42')
  await page.getByRole('button', { name: 'Salvar nova senha' }).click()
  await expect(page.getByText('As senhas não coincidem')).toBeVisible()

  await page.getByLabel('Repita a nova senha').fill(NEW_PASSWORD)
  await page.getByRole('button', { name: 'Salvar nova senha' }).click()
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible()
  await expect(page.getByRole('status')).toContainText('Senha alterada')
}

test('esqueci a senha: link por e-mail, nova senha e login com ela', async ({ page }) => {
  test.setTimeout(90_000)
  const user = await createUser('reset')
  await page.goto('/recuperar-senha')
  await expectNoViolations(page, 'recuperar senha')

  await requestReset(page, user.email)
  const link = linkIn(await waitForMail(user.email), '/auth/v1/verify')
  await page.goto(link)
  await setNewPassword(page)

  // A senha antiga deixa de valer e a nova entra.
  await page.getByLabel('E-mail').fill(user.email)
  await page.getByLabel('Senha').fill(user.password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('alert')).toHaveText('E-mail ou senha incorretos.')

  await page.getByLabel('Senha').fill(NEW_PASSWORD)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('heading', { name: 'Central do dia' })).toBeVisible()
})

test('com verificação em duas etapas, a recuperação pede o código antes da nova senha', async ({ page }) => {
  test.setTimeout(90_000)
  const user = await createUser('reset-mfa')
  const secret = await enableMfa(user)

  await requestReset(page, user.email)
  const link = linkIn(await waitForMail(user.email), '/auth/v1/verify')
  await page.goto(link)

  await expect(page.getByRole('heading', { name: 'Confirme que é você' })).toBeVisible()
  await expect(page.getByLabel('Nova senha', { exact: true })).toHaveCount(0)
  await page.getByLabel('Código de verificação').fill(totp(secret))
  await page.getByRole('button', { name: 'Verificar' }).click()
  await setNewPassword(page)

  // Nova senha + código para entrar.
  await page.getByLabel('E-mail').fill(user.email)
  await page.getByLabel('Senha').fill(NEW_PASSWORD)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Verificação em duas etapas' })).toBeVisible()
  await page.getByLabel('Código de verificação').fill(totp(secret))
  await page.getByRole('button', { name: 'Verificar' }).click()
  await expect(page.getByRole('heading', { name: 'Central do dia' })).toBeVisible()
})

test('e-mail sem conta recebe a mesma resposta e link ausente mostra aviso', async ({ page }) => {
  await requestReset(page, `ninguem-${Date.now()}@test.local`)

  await page.goto('/redefinir-senha')
  await expect(page.getByRole('heading', { name: 'Link inválido ou expirado' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Pedir um novo link' })).toBeVisible()
})

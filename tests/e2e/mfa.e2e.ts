import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { totp } from '../support/totp'
import { createUser, login } from './helpers'

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

async function expectNoViolations(page: Page, label: string) {
  await page.waitForLoadState('networkidle')
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze()
  const summary = results.violations.map((v) => ({
    rule: v.id,
    impact: v.impact,
    nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ')),
  }))
  expect(summary, `violações de acessibilidade em ${label}`).toEqual([])
}

test('verificação em duas etapas: ativar, exigir o código no login e desativar', async ({ page }) => {
  test.setTimeout(120_000)
  const user = await createUser('mfa')
  await login(page, user)

  // Ativar pela tela de Configurações.
  await page.goto('/app/configuracoes')
  await expect(page.getByText('Situação: desativada')).toBeVisible()
  await page.getByRole('button', { name: 'Ativar verificação em duas etapas' }).click()
  await expect(page.getByAltText('QR code para o aplicativo autenticador')).toBeVisible()
  const secret = (await page.getByTestId('mfa-secret').innerText()).trim()
  expect(secret).toMatch(/^[A-Z2-7]{16,}$/)
  await expectNoViolations(page, 'configurações com a inscrição aberta')

  await page.getByLabel('Código de verificação').fill('000000')
  await page.getByRole('button', { name: 'Confirmar e ativar' }).click()
  await expect(page.getByRole('alert')).toContainText('Código inválido')

  await page.getByLabel('Código de verificação').fill(totp(secret))
  await page.getByRole('button', { name: 'Confirmar e ativar' }).click()
  await expect(page.getByText('Situação: ativada')).toBeVisible()

  // Novo acesso: só a senha não basta.
  await page.getByRole('button', { name: 'Sair' }).click()
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible()
  await page.getByLabel('E-mail').fill(user.email)
  await page.getByLabel('Senha').fill(user.password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Verificação em duas etapas' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Central do dia' })).toHaveCount(0)
  await expectNoViolations(page, 'segunda etapa do login')

  // Rota protegida direta também volta para o código.
  await page.goto('/app/tarefas')
  await expect(page.getByRole('heading', { level: 1, name: 'Verificação em duas etapas' })).toBeVisible()

  await page.getByLabel('Código de verificação').fill('123456')
  await page.getByRole('button', { name: 'Verificar' }).click()
  await expect(page.getByRole('alert')).toContainText('Código inválido')

  await page.getByLabel('Código de verificação').fill(totp(secret))
  await page.getByRole('button', { name: 'Verificar' }).click()
  // Volta para a rota que tinha sido pedida.
  await expect(page).toHaveURL(/\/app\/tarefas$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Tarefas' })).toBeVisible()

  // A sessão aal2 sobrevive ao recarregamento.
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Tarefas' })).toBeVisible()

  // Desativar (pede confirmação).
  await page.goto('/app/configuracoes')
  await page.getByRole('button', { name: 'Desativar', exact: true }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Desativar' }).click()
  await expect(page.getByText('Situação: desativada')).toBeVisible()
})

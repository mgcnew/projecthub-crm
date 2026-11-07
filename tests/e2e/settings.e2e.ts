import { expect, test } from '@playwright/test'
import { createUser, login } from './helpers'

test('configurações em abas: perfil, e-mail, espaço de trabalho e preferências', async ({ page }) => {
  const user = await createUser('settings')
  await login(page, user)
  await page.goto('/app/configuracoes')

  // Quatro abas; a primeira (Perfil) abre por padrão e o menu lateral leva até ela.
  const tabs = page.getByRole('tablist', { name: 'Seções de configurações' })
  await expect(tabs.getByRole('tab')).toHaveText(['Perfil', 'Conta e segurança', 'Preferências', 'Espaço de trabalho'])
  await expect(tabs.getByRole('tab', { name: 'Perfil' })).toHaveAttribute('aria-selected', 'true')

  // Perfil: editar o nome aparece no menu lateral e sobrevive ao recarregar.
  const panel = page.getByRole('tabpanel', { name: 'Perfil' })
  await expect(panel.getByLabel('E-mail de acesso')).toHaveValue(user.email)
  await panel.getByLabel('Nome', { exact: true }).fill('Maria da Silva')
  await panel.getByRole('button', { name: 'Salvar perfil' }).click()
  await expect(panel.getByRole('status')).toHaveText('Perfil salvo.')
  const profileLink = page.getByRole('link', { name: 'Seu perfil: Maria da Silva' })
  await expect(profileLink).toBeVisible()
  await page.reload()
  await expect(page.getByRole('link', { name: 'Seu perfil: Maria da Silva' })).toBeVisible()

  // Nome vazio é recusado com mensagem.
  await panel.getByLabel('Nome', { exact: true }).fill('   ')
  await panel.getByRole('button', { name: 'Salvar perfil' }).click()
  await expect(panel.getByText('Informe seu nome')).toBeVisible()

  // Navegação por teclado entre as abas; a aba vai para a URL.
  await tabs.getByRole('tab', { name: 'Perfil' }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(tabs.getByRole('tab', { name: 'Conta e segurança' })).toHaveAttribute('aria-selected', 'true')
  await expect(page).toHaveURL(/aba=seguranca/)

  // Conta e segurança: pedir a troca de e-mail (o Auth manda o link de confirmação).
  const account = page.getByRole('tabpanel', { name: 'Conta e segurança' })
  await account.getByLabel('Novo e-mail').fill('invalido')
  await account.getByRole('button', { name: 'Pedir troca de e-mail' }).click()
  await expect(account.getByText('E-mail inválido')).toBeVisible()
  await account.getByLabel('Novo e-mail').fill(`novo-${Date.now()}@test.local`)
  await account.getByRole('button', { name: 'Pedir troca de e-mail' }).click()
  await expect(account.getByRole('status').filter({ hasText: 'Enviamos um link' })).toBeVisible()

  // Espaço de trabalho: o proprietário renomeia e o nome aparece na Central do dia.
  await page.getByRole('tab', { name: 'Espaço de trabalho' }).click()
  const space = page.getByRole('tabpanel', { name: 'Espaço de trabalho' })
  await space.getByLabel('Nome do espaço').fill('Estúdio Voltier')
  await space.getByRole('button', { name: 'Salvar nome' }).click()
  await expect(space.getByText('Nome do espaço salvo.')).toBeVisible()
  await page.goto('/app')
  await expect(page.getByText(/Estúdio Voltier/).first()).toBeVisible()

  // Preferências: o fuso continua aqui.
  await page.goto('/app/configuracoes?aba=preferencias')
  await expect(page.getByRole('heading', { name: 'Fuso de trabalho' })).toBeVisible()
})

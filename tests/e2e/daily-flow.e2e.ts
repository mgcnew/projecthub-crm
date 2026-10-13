import { expect, test } from '@playwright/test'
import { createUser, login } from './helpers'

test('fluxo diário: cliente → projeto → tarefa planejada → concluir aparece em todas as telas', async ({ page }) => {
  const user = await createUser('daily')
  await login(page, user)

  // Cliente
  await page.goto('/app/clientes/novo')
  await page.getByLabel('Nome *').fill('Acme Ltda')
  await page.getByRole('button', { name: 'Criar cliente' }).click()
  await expect(page.getByRole('heading', { name: 'Acme Ltda' })).toBeVisible()

  // Projeto vinculado ao cliente
  await page.goto('/app/projetos/novo')
  await page.getByLabel('Nome *').fill('Site institucional')
  await page.getByLabel('Cliente').selectOption({ label: 'Acme Ltda' })
  await page.getByRole('button', { name: 'Criar projeto' }).click()
  await expect(page.getByRole('heading', { name: 'Site institucional' })).toBeVisible()

  // Projeto sem cliente também é válido
  await page.goto('/app/projetos/novo')
  await page.getByLabel('Nome *').fill('Estudos internos')
  await page.getByRole('button', { name: 'Criar projeto' }).click()
  await expect(page.getByRole('heading', { name: 'Estudos internos' })).toBeVisible()

  // Captura rápida no Meu dia (só o título) já planeja para hoje
  await page.goto('/app/meu-dia')
  await page.getByLabel('Nova tarefa para este dia').fill('Preparar proposta')
  await page.keyboard.press('Enter')
  const checkbox = page.getByRole('checkbox', { name: 'Concluir Preparar proposta' })
  await expect(checkbox).toBeVisible()
  await expect(checkbox).not.toBeChecked()

  // Dashboard lê a mesma tarefa: 0/1 planejadas
  await page.getByRole('link', { name: 'Início' }).first().click()
  await expect(page.getByText('0/1')).toBeVisible()
  // Controlado: muda depois da resposta do servidor, então não usar .check().
  await page.getByRole('checkbox', { name: 'Concluir Preparar proposta' }).click()
  await expect(page.getByText('1/1')).toBeVisible()

  // A conclusão aparece no Meu dia
  await page.getByRole('link', { name: 'Meu dia' }).first().click()
  await expect(page.getByRole('checkbox', { name: 'Concluir Preparar proposta' })).toBeChecked()

  // E na lista de tarefas (filtro "todas")
  await page.goto('/app/tarefas')
  await page.getByLabel('Situação').selectOption('all').catch(() => undefined)
  await expect(page.getByRole('link', { name: /Preparar proposta/ })).toBeVisible({ timeout: 15_000 })

  // A Central do dia registra o que mudou (trilha gravada no banco, título resolvido na leitura)
  await page.goto('/app')
  const feed = page.getByRole('region', { name: 'Atividade recente' })
  await expect(feed.getByRole('link', { name: 'Preparar proposta' }).first()).toBeVisible()
  await expect(feed.getByText(/Você alterou o status: A fazer → Concluída/)).toBeVisible()
  await expect(feed.getByRole('link', { name: 'Site institucional' }).first()).toBeVisible()
})

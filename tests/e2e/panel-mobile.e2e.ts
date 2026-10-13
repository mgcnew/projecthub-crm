import { expect, test } from '@playwright/test'
import { apiSessionFor, createUser, login } from './helpers'

// Celular: a mesma rota é a página inteira (sem painel), com as mesmas abas.
test('no celular o registro é página inteira com abas', async ({ page }) => {
  const user = await createUser('panelm')
  const { client, orgId } = await apiSessionFor(user)
  const t = await client.from('tasks').insert({ organization_id: orgId, title: 'Tarefa mobile' }).select('id').single()
  await login(page, user)

  await page.goto(`/app/tarefas/${t.data!.id}`)
  await expect(page.getByRole('heading', { name: 'Tarefa mobile', level: 1 })).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('tab', { name: 'Detalhes' })).toHaveAttribute('aria-selected', 'true')

  await page.getByRole('tab', { name: 'Lembretes' }).click()
  await expect(page).toHaveURL(/aba=lembretes/)
  await expect(page.getByLabel('Avisar em')).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(overflow).toBe(false)
})

import { expect, test } from '@playwright/test'
import { apiSessionFor, createUser, login } from './helpers'

test('concluir tarefa é otimista: muda na hora e volta se o servidor falhar', async ({ page }) => {
  const user = await createUser('opt')
  const { client, orgId } = await apiSessionFor(user)
  await client.from('tasks').insert([
    { organization_id: orgId, title: 'Tarefa lenta', priority: 'medium' },
    { organization_id: orgId, title: 'Tarefa que falha', priority: 'medium' },
  ])
  await login(page, user)
  await page.goto('/app/tarefas')

  // 1) Servidor lento (3 s): o checkbox já aparece marcado bem antes da resposta
  let release!: () => void
  const gate = new Promise<void>((r) => (release = r))
  await page.route('**/rest/v1/tasks?*', async (route) => {
    if (route.request().method() === 'PATCH') {
      await gate
      return route.continue()
    }
    return route.fallback()
  })
  const slow = page.getByRole('checkbox', { name: 'Concluir Tarefa lenta' })
  await slow.click()
  await expect(slow).toBeChecked({ timeout: 800 })
  release()
  await expect(slow).toBeChecked()
  await page.unroute('**/rest/v1/tasks?*')

  // 2) Falha do servidor: a marcação é desfeita
  await page.route('**/rest/v1/tasks?*', async (route) => {
    if (route.request().method() !== 'PATCH') return route.fallback()
    await new Promise((r) => setTimeout(r, 1500)) // a falha chega depois da marcação otimista
    return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'falha simulada' }) })
  })
  const failing = page.getByRole('checkbox', { name: 'Concluir Tarefa que falha' })
  await expect(failing).not.toBeChecked()
  await failing.click()
  await expect(failing).toBeChecked({ timeout: 800 }) // otimista
  await expect(failing).not.toBeChecked({ timeout: 8_000 }) // revertido após o erro
})

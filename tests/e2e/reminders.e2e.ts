import { expect, test } from '@playwright/test'
import { apiSessionFor, createUser, localInput, login, panel } from './helpers'

// Percorre o caminho real: lembrete na UI → worker do pg_cron (a cada minuto) → sino → notificação.
test('lembrete de tarefa dispara pelo worker e aparece como notificação', async ({ page }) => {
  test.setTimeout(180_000)
  const user = await createUser('rem')
  const { client, orgId } = await apiSessionFor(user)
  const task = await client
    .from('tasks')
    .insert({ organization_id: orgId, title: 'Enviar contrato' })
    .select('id')
    .single()
  expect(task.error).toBeNull()

  await login(page, user)
  await page.goto(`/app/tarefas/${task.data!.id}?aba=lembretes`)
  await expect(panel(page).getByRole('heading', { name: 'Enviar contrato' })).toBeVisible()

  await panel(page).getByLabel('Avisar em').fill(localInput(new Date(Date.now() + 5_000)))
  await panel(page).getByRole('button', { name: 'Adicionar lembrete' }).click()
  await expect(panel(page).getByRole('button', { name: 'Remover' }).first()).toBeVisible()

  // O contador do sino atualiza por polling (60 s) ou ao focar; força a releitura recarregando.
  await expect
    .poll(
      async () => {
        await page.reload()
        return page.getByRole('navigation', { name: 'Principal' }).first().getByText(/1 não lida/).count()
      },
      { timeout: 130_000, intervals: [10_000] },
    )
    .toBeGreaterThan(0)

  await page.goto('/app/notificacoes')
  await expect(page.getByRole('link', { name: 'Enviar contrato' })).toBeVisible()
  await page.getByRole('button', { name: 'Marcar como lida' }).click()
  await expect(page.getByText('Lida', { exact: true })).toBeVisible()
  await expect(page.getByText(/\d+ não lidas?/)).toHaveCount(0)
})

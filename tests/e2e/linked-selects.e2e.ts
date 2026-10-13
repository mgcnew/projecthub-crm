import { expect, test } from '@playwright/test'
import { apiSessionFor, createUser, login, panel } from './helpers'

// Regressão: ao abrir um registro com projeto/cliente, o select mostrava "Sem …" (opções carregam
// depois do formulário) e salvar podia desvincular. O vínculo precisa aparecer e sobreviver ao salvar.
test('selects de projeto/cliente refletem o vínculo salvo e o salvar o preserva', async ({ page }) => {
  const user = await createUser('sel')
  const { client, orgId } = await apiSessionFor(user)
  const c = await client.from('clients').insert({ organization_id: orgId, name: 'Cliente Sel' }).select('id').single()
  const p = await client
    .from('projects')
    .insert({ organization_id: orgId, name: 'Projeto Sel', client_id: c.data!.id })
    .select('id')
    .single()
  const t = await client
    .from('tasks')
    .insert({ organization_id: orgId, title: 'Tarefa Sel', project_id: p.data!.id, client_id: c.data!.id })
    .select('id')
    .single()
  const start = new Date(Date.now() + 3_600_000)
  const e = await client
    .from('calendar_events')
    .insert({
      organization_id: orgId,
      title: 'Evento Sel',
      project_id: p.data!.id,
      client_id: c.data!.id,
      starts_at: start.toISOString(),
      ends_at: new Date(start.getTime() + 3_600_000).toISOString(),
      timezone: 'America/Sao_Paulo',
    })
    .select('id')
    .single()

  await login(page, user)

  // Projeto (carga direta: sem cache das opções)
  await page.goto(`/app/projetos/${p.data!.id}`)
  await expect(panel(page).getByLabel('Cliente', { exact: true })).toHaveValue(c.data!.id)
  await panel(page).getByLabel('Nome *').fill('Projeto Sel renomeado')
  await panel(page).getByRole('button', { name: 'Salvar alterações' }).click()
  await expect(panel(page).getByText('Alterações salvas.')).toBeVisible()
  await page.reload()
  await expect(panel(page).getByLabel('Cliente', { exact: true })).toHaveValue(c.data!.id)

  // Tarefa
  await page.goto(`/app/tarefas/${t.data!.id}`)
  await expect(panel(page).getByLabel('Projeto', { exact: true })).toHaveValue(p.data!.id)
  await expect(panel(page).getByLabel('Cliente', { exact: true })).toHaveValue(c.data!.id)
  await panel(page).getByLabel('Título *').fill('Tarefa Sel renomeada')
  await panel(page).getByRole('button', { name: 'Salvar alterações' }).click()
  await expect(panel(page).getByText('Alterações salvas.')).toBeVisible()
  await page.reload()
  await expect(panel(page).getByLabel('Projeto', { exact: true })).toHaveValue(p.data!.id)
  await expect(panel(page).getByLabel('Cliente', { exact: true })).toHaveValue(c.data!.id)

  // Evento
  await page.goto(`/app/agenda/${e.data!.id}`)
  await expect(panel(page).getByLabel('Projeto', { exact: true })).toHaveValue(p.data!.id)
  await expect(panel(page).getByLabel('Cliente', { exact: true })).toHaveValue(c.data!.id)
  await panel(page).getByLabel('Título *').fill('Evento Sel renomeado')
  await panel(page).getByRole('button', { name: 'Salvar alterações' }).click()
  await expect(panel(page).getByText('Alterações salvas.')).toBeVisible()
  await page.reload()
  await expect(panel(page).getByLabel('Projeto', { exact: true })).toHaveValue(p.data!.id)
  await expect(panel(page).getByLabel('Cliente', { exact: true })).toHaveValue(c.data!.id)
})

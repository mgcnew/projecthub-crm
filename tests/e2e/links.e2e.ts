import { expect, test } from '@playwright/test'
import { apiSessionFor, createUser, login, panel } from './helpers'

// Vínculos: projeto e cliente mostram (e criam) as tarefas e reuniões ligadas a eles.
test('projeto e cliente enxergam as tarefas e reuniões vinculadas', async ({ page }) => {
  const user = await createUser('links')
  const { client, orgId } = await apiSessionFor(user)

  const c = await client.from('clients').insert({ organization_id: orgId, name: 'Cliente Vínculo' }).select('id').single()
  const p = await client
    .from('projects')
    .insert({ organization_id: orgId, name: 'Projeto Vínculo', client_id: c.data!.id })
    .select('id')
    .single()
  // Tarefa sem projeto: não pode aparecer nos vínculos nem no filtro por projeto.
  await client.from('tasks').insert({ organization_id: orgId, title: 'Tarefa solta' })

  await login(page, user)

  // Projeto: captura rápida já vinculada
  await page.goto(`/app/projetos/${p.data!.id}?aba=tarefas`)
  await panel(page).getByLabel('Nova tarefa neste projeto').fill('Revisar escopo')
  await page.keyboard.press('Enter')
  const tasks = panel(page).getByRole('region', { name: /Tarefas/ })
  await expect(tasks.getByRole('link', { name: 'Revisar escopo' })).toBeVisible()
  await expect(tasks.getByText('Tarefa solta')).toHaveCount(0)

  // "Ver todas" abre a lista já filtrada pelo projeto
  await tasks.getByRole('link', { name: 'Ver todas' }).click()
  await expect(page).toHaveURL(/\/app\/tarefas\?projeto=/)
  await expect(page.getByLabel('Projeto', { exact: true })).toHaveValue(p.data!.id)
  await expect(page.getByRole('link', { name: /Revisar escopo/ })).toBeVisible()
  await expect(page.getByText('Tarefa solta')).toHaveCount(0)

  // Nova reunião a partir do projeto: projeto e cliente já selecionados
  await page.goto(`/app/projetos/${p.data!.id}?aba=reunioes`)
  await panel(page).getByRole('link', { name: 'Nova reunião' }).click()
  await expect(panel(page).getByRole('heading', { name: 'Nova reunião' })).toBeVisible()
  await expect(panel(page).getByLabel('Projeto', { exact: true })).toHaveValue(p.data!.id)
  await expect(panel(page).getByLabel('Cliente', { exact: true })).toHaveValue(c.data!.id)
  await panel(page).getByLabel('Título *').fill('Kickoff do projeto')
  await panel(page).getByRole('button', { name: 'Criar' }).click()
  await expect(panel(page).getByRole('heading', { name: 'Kickoff do projeto' })).toBeVisible()

  // A reunião aparece no projeto
  await page.goto(`/app/projetos/${p.data!.id}?aba=reunioes`)
  const events = panel(page).getByRole('region', { name: 'Reuniões e eventos' })
  await expect(events.getByRole('link', { name: /Kickoff do projeto/ })).toBeVisible()

  // Cliente: enxerga a tarefa e a reunião que passam pelo projeto
  await page.goto(`/app/clientes/${c.data!.id}?aba=tarefas`)
  await expect(panel(page).getByRole('link', { name: 'Revisar escopo' })).toBeVisible()
  await expect(panel(page).getByText('Tarefa solta')).toHaveCount(0)

  // Captura rápida no cliente: vira tarefa do cliente (sem projeto)
  await panel(page).getByLabel('Nova tarefa para este cliente').fill('Ligar para o cliente')
  await page.keyboard.press('Enter')
  await expect(panel(page).getByRole('link', { name: 'Ligar para o cliente' })).toBeVisible()

  // Concluir pelo vínculo some da lista de abertas
  await panel(page).getByRole('checkbox', { name: 'Concluir Ligar para o cliente' }).click()
  await expect(panel(page).getByRole('link', { name: 'Ligar para o cliente' })).toHaveCount(0)

  // A reunião do projeto aparece na aba de reuniões do cliente
  await panel(page).getByRole('tab', { name: 'Reuniões e eventos' }).click()
  await expect(panel(page).getByRole('link', { name: /Kickoff do projeto/ })).toBeVisible()
})

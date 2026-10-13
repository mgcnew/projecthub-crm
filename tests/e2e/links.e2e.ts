import { expect, test } from '@playwright/test'
import { apiSessionFor, createUser, login } from './helpers'

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
  await page.goto(`/app/projetos/${p.data!.id}`)
  await page.getByLabel('Nova tarefa neste projeto').fill('Revisar escopo')
  await page.keyboard.press('Enter')
  const tasks = page.getByRole('region', { name: /Tarefas/ })
  await expect(tasks.getByRole('link', { name: 'Revisar escopo' })).toBeVisible()
  await expect(tasks.getByText('Tarefa solta')).toHaveCount(0)

  // "Ver todas" abre a lista já filtrada pelo projeto
  await tasks.getByRole('link', { name: 'Ver todas' }).click()
  await expect(page).toHaveURL(/\/app\/tarefas\?projeto=/)
  await expect(page.getByLabel('Projeto', { exact: true })).toHaveValue(p.data!.id)
  await expect(page.getByRole('link', { name: /Revisar escopo/ })).toBeVisible()
  await expect(page.getByText('Tarefa solta')).toHaveCount(0)

  // Nova reunião a partir do projeto: projeto e cliente já selecionados
  await page.goto(`/app/projetos/${p.data!.id}`)
  await page.getByRole('link', { name: 'Nova reunião' }).click()
  await expect(page.getByRole('heading', { name: 'Nova reunião', level: 1 })).toBeVisible()
  await expect(page.getByLabel('Projeto', { exact: true })).toHaveValue(p.data!.id)
  await expect(page.getByLabel('Cliente', { exact: true })).toHaveValue(c.data!.id)
  await page.getByLabel('Título *').fill('Kickoff do projeto')
  await page.getByRole('button', { name: 'Criar' }).click()
  await expect(page.getByRole('heading', { name: 'Kickoff do projeto' })).toBeVisible()

  // A reunião aparece no projeto
  await page.goto(`/app/projetos/${p.data!.id}`)
  const events = page.getByRole('region', { name: 'Reuniões e eventos' })
  await expect(events.getByRole('link', { name: /Kickoff do projeto/ })).toBeVisible()

  // Cliente: enxerga a tarefa e a reunião que passam pelo projeto
  await page.goto(`/app/clientes/${c.data!.id}`)
  await expect(page.getByRole('link', { name: 'Revisar escopo' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Kickoff do projeto/ })).toBeVisible()
  await expect(page.getByText('Tarefa solta')).toHaveCount(0)

  // Captura rápida no cliente: vira tarefa do cliente (sem projeto)
  await page.getByLabel('Nova tarefa para este cliente').fill('Ligar para o cliente')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('link', { name: 'Ligar para o cliente' })).toBeVisible()

  // Concluir pelo vínculo some da lista de abertas
  await page.getByRole('checkbox', { name: 'Concluir Ligar para o cliente' }).click()
  await expect(page.getByRole('link', { name: 'Ligar para o cliente' })).toHaveCount(0)
})

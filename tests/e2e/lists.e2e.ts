import { expect, test } from '@playwright/test'
import { apiSessionFor, createUser, login } from './helpers'

test('ordenação por coluna e filtros lembrados entre visitas', async ({ page }) => {
  const user = await createUser('lists')
  const { client, orgId } = await apiSessionFor(user)
  const rows = [
    { title: 'Zeta baixa', priority: 'low' },
    { title: 'Alfa urgente', priority: 'urgent' },
    { title: 'Mica média', priority: 'medium' },
    { title: 'Beta alta', priority: 'high' },
  ].map((t) => ({ organization_id: orgId, ...t }))
  for (const r of rows) await client.from('tasks').insert(r) // ordem de criação conhecida

  await login(page, user)
  await page.goto('/app/tarefas')
  const titles = () =>
    page.getByRole('table').getByRole('link').evaluateAll((els) => els.map((e) => e.querySelector('span')?.textContent?.trim()))

  // Prioridade: cabeçalho ordena do mais importante e inverte ao clicar de novo
  await page.getByRole('button', { name: 'Prioridade' }).click()
  await expect.poll(titles).toEqual(['Alfa urgente', 'Beta alta', 'Mica média', 'Zeta baixa'])
  await expect(page.getByRole('columnheader', { name: /Prioridade/ })).toHaveAttribute('aria-sort', 'descending')
  await page.getByRole('button', { name: 'Prioridade' }).click()
  await expect.poll(titles).toEqual(['Zeta baixa', 'Mica média', 'Beta alta', 'Alfa urgente'])

  // Título A–Z pelo seletor (o único controle de ordem no celular)
  await page.getByLabel('Ordenar por').selectOption('titulo')
  await expect.poll(titles).toEqual(['Alfa urgente', 'Beta alta', 'Mica média', 'Zeta baixa'])

  // Filtro por prioridade + ordem sobrevivem ao recarregamento
  await page.getByLabel('Prioridade', { exact: true }).selectOption('high')
  await expect.poll(titles).toEqual(['Beta alta'])
  await page.reload()
  await expect(page.getByLabel('Prioridade', { exact: true })).toHaveValue('high')
  await expect(page.getByLabel('Ordenar por')).toHaveValue('titulo')
  await expect.poll(titles).toEqual(['Beta alta'])

  // Limpar volta ao padrão (abertas, por prazo) e esquece o que estava salvo
  await page.getByRole('button', { name: 'Limpar filtros e ordem' }).click()
  await expect(page.getByLabel('Prioridade', { exact: true })).toHaveValue('')
  await expect(page.getByLabel('Ordenar por')).toHaveValue('prazo')
  await page.reload()
  await expect(page.getByLabel('Ordenar por')).toHaveValue('prazo')
  await expect.poll(async () => (await titles()).length).toBe(4)
})

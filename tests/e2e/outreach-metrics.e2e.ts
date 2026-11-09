import { expect, test } from '@playwright/test'
import { apiSessionFor, createUser, login } from './helpers'

test('métricas: funil por etapa, convertidos no mês e tabelas de taxa de resposta', async ({ page }) => {
  test.setTimeout(90_000)
  const user = await createUser('outreach-metrics')
  const { client, orgId } = await apiSessionFor(user)
  const base = { organization_id: orgId, source: 'teste', stage: 'new' }
  await client.from('leads').insert([
    { ...base, company_name: 'Alfa', email: 'alfa@ex.com', contact_name: 'Ana' },
    { ...base, company_name: 'Beta', email: 'beta@ex.com', stage: 'replied' },
    { ...base, company_name: 'Gama', email: 'gama@ex.com', stage: 'meeting' },
  ])
  const alfa = await client.from('leads').select('id').eq('company_name', 'Alfa').single()
  const conv = await client.rpc('convert_lead', { p_lead: alfa.data!.id })
  expect(conv.error).toBeNull()

  await login(page, user)
  await page.goto('/app/prospeccao/metricas')
  await expect(page.getByRole('heading', { level: 1, name: 'Métricas' })).toBeVisible()
  const resumo = page.getByLabel('Resumo')
  await expect(resumo.getByText('Convertidos no mês').locator('xpath=following-sibling::dd[1]')).toHaveText('1')
  await expect(resumo.getByText('Leads ativos').locator('xpath=following-sibling::dd[1]')).toHaveText('3')
  // Funil: Ganho 1 (convertido), Respondeu 1, Reunião 1.
  await expect(page.getByLabel('Ganho: 1')).toBeVisible()
  await expect(page.getByLabel('Respondeu: 1')).toBeVisible()
  await expect(page.getByLabel('Reunião: 1')).toBeVisible()
  await expect(page.getByLabel('Novo: 0')).toBeVisible()
  // Sem envios ainda: as tabelas explicam.
  await expect(page.getByText('Sem mensagens enviadas ainda.').first()).toBeVisible()
})

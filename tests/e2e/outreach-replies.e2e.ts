import { expect, test } from '@playwright/test'
import { apiSessionFor, createUser, login, panel } from './helpers'

test('respostas: registrar, reação do lead, "SAIR", conversa, conversão sem duplicar e busca global', async ({ page }) => {
  test.setTimeout(150_000)
  const user = await createUser('outreach-replies')
  const { client, orgId } = await apiSessionFor(user)
  const base = { organization_id: orgId, source: 'planilha', stage: 'contacted' }
  await client.from('leads').insert([
    { ...base, company_name: 'Alfa Padaria', contact_name: 'Maria Souza', email: 'alfa@ex.com', phone: '+5511911111111' },
    { ...base, company_name: 'Beta Clínica', email: 'beta@ex.com' },
    { ...base, company_name: 'Gama Mercado', contact_name: 'Gil', email: 'gama@ex.com' },
  ])
  // Cliente que já existe com o mesmo e-mail do lead "Gama": a conversão precisa oferecer o vínculo.
  await client.from('clients').insert({ organization_id: orgId, name: 'Gama Mercado Ltda', email: 'gama@ex.com' })

  await login(page, user)
  await page.goto('/app/prospeccao/respostas')
  await expect(page.getByRole('heading', { level: 1, name: 'Respostas' })).toBeVisible()
  await expect(page.getByText('Nenhuma resposta nova')).toBeVisible()

  // Registrar a resposta da Alfa: etapa e temperatura reagem.
  await page.getByRole('button', { name: 'Registrar resposta' }).first().click()
  const reg = page.getByRole('region', { name: 'Registrar resposta' })
  await reg.getByLabel('Lead', { exact: true }).selectOption({ label: 'Alfa Padaria' })
  await reg.getByLabel('O que o lead respondeu').fill('Tenho interesse! Pode me ligar amanhã?')
  await reg.getByRole('button', { name: 'Registrar', exact: true }).click()
  await expect(reg.getByText(/Resposta registrada/)).toBeVisible()
  await expect(page.getByRole('listitem').filter({ hasText: 'Alfa Padaria' }).getByText('Nova', { exact: true })).toBeVisible()
  const alfa = await client.from('leads').select('stage, temperature').eq('company_name', 'Alfa Padaria').single()
  expect(alfa.data).toEqual({ stage: 'replied', temperature: 'warm' })

  // "SAIR" vira não contatar e entra na supressão.
  await reg.getByLabel('Lead', { exact: true }).selectOption({ label: 'Beta Clínica' })
  await reg.getByLabel('O que o lead respondeu').fill('SAIR')
  await reg.getByRole('button', { name: 'Registrar', exact: true }).click()
  await expect(reg.getByText(/Resposta registrada/)).toBeVisible()
  const beta = await client.from('leads').select('opted_out_at').eq('company_name', 'Beta Clínica').single()
  expect(beta.data!.opted_out_at).not.toBeNull()
  const sup = await client.from('suppression_list').select('value').eq('value', 'beta@ex.com')
  expect(sup.data).toHaveLength(1)

  // Central do dia: placa de respostas novas; marcar como lidas a faz sumir.
  await page.goto('/app')
  await expect(page.getByRole('heading', { name: 'Respostas novas' })).toBeVisible()
  await page.goto('/app/prospeccao/respostas')
  await page.getByRole('button', { name: /Marcar 2 como lidas/ }).click()
  await expect(page.getByText('Nenhuma resposta nova')).toBeVisible()
  await page.goto('/app')
  await expect(page.getByRole('heading', { name: 'Respostas novas' })).toHaveCount(0)

  // Conversa do lead e conversão: cria cliente + contato + projeto e marca como ganho.
  const alfaId = (await client.from('leads').select('id').eq('company_name', 'Alfa Padaria').single()).data!.id
  await page.goto(`/app/prospeccao/leads/${alfaId}?aba=conversa`)
  const p = panel(page)
  await expect(p.getByText('Tenho interesse! Pode me ligar amanhã?')).toBeVisible()
  await expect(p.getByText('Resposta do lead')).toBeVisible()
  await p.getByLabel('Projeto (opcional)').fill('Sistema de pedidos')
  await p.getByRole('button', { name: 'Criar novo cliente' }).click()
  await expect(p.getByText('Este lead já virou cliente.')).toBeVisible()
  const converted = await client.from('leads').select('stage, converted_client_id').eq('id', alfaId).single()
  expect(converted.data!.stage).toBe('won')
  const clientId = converted.data!.converted_client_id as string
  const contacts = await client.from('client_contacts').select('name, is_primary').eq('client_id', clientId)
  expect(contacts.data).toEqual([{ name: 'Maria Souza', is_primary: true }])
  const projects = await client.from('projects').select('name').eq('client_id', clientId)
  expect(projects.data).toEqual([{ name: 'Sistema de pedidos' }])

  // Já existe cliente com o mesmo e-mail: vincula em vez de duplicar.
  const gamaId = (await client.from('leads').select('id').eq('company_name', 'Gama Mercado').single()).data!.id
  await page.goto(`/app/prospeccao/leads/${gamaId}?aba=conversa`)
  const g = panel(page)
  await expect(g.getByRole('group', { name: 'Clientes parecidos' })).toContainText('Gama Mercado Ltda')
  await g.getByRole('button', { name: 'Vincular a este cliente' }).click()
  await expect(g.getByText('Este lead já virou cliente.')).toBeVisible()
  const clients = await client.from('clients').select('id')
  expect(clients.data).toHaveLength(2) // Gama (existente) + Alfa (novo); nada duplicado

  // Busca global encontra o lead.
  await page.goto('/app')
  await page.keyboard.press('Control+k')
  const dialog = page.getByRole('dialog', { name: 'Buscar' })
  await dialog.getByRole('combobox').fill('Beta Cl')
  await expect(dialog.getByRole('option', { name: /Beta Clínica/ })).toBeVisible()
  await expect(dialog.getByText('Leads', { exact: true })).toBeVisible()
})

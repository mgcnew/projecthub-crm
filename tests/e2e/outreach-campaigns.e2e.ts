import { expect, test } from '@playwright/test'
import { apiSessionFor, createUser, login, panel } from './helpers'

test('campanhas: criar a sequência, incluir leads, gerar rascunhos, resposta para a sequência e pausa bloqueia', async ({ page }) => {
  test.setTimeout(180_000)
  const user = await createUser('outreach-camp')
  const { client, orgId } = await apiSessionFor(user)
  const base = { organization_id: orgId, source: 'teste' }
  await client.from('leads').insert([
    { ...base, company_name: 'Alfa Padaria', email: 'alfa@ex.com', hook: 'que vocês entregam no bairro' },
    { ...base, company_name: 'Beta Clínica', email: 'beta@ex.com' },
    { ...base, company_name: 'Gama Sem Email', phone: '+5511911111111' },
  ])
  await client.from('products').insert({ organization_id: orgId, name: 'Sistema de pedidos', value_proposition: 'cardápio digital sem taxa' })
  for (const step of [1, 2, 3]) {
    await client.from('message_templates').insert({
      organization_id: orgId,
      name: `Passo ${step}`,
      channel: 'email',
      step,
      subject: step === 1 ? 'Ideia para a {{empresa}}' : `Lembrete ${step - 1}`,
      body: step === 1 ? 'Vi {{gancho}}. O {{sistema}} traz {{proposta}}. Faz sentido?' : 'Só passando para retomar. Faz sentido?',
    })
  }

  await login(page, user)
  await page.goto('/app/prospeccao/campanhas')
  await expect(page.getByRole('heading', { level: 1, name: 'Campanhas' })).toBeVisible()
  await expect(page.getByText('Nenhuma campanha ainda')).toBeVisible()

  // Criar: validações da sequência e depois a campanha.
  await page.getByRole('link', { name: 'Nova campanha' }).first().click()
  const f = panel(page)
  await f.getByLabel('Nome da campanha *').fill('Pedidos — novembro')
  await f.getByLabel('1º lembrete (dias depois)').fill('7')
  await f.getByLabel('2º lembrete (dias depois)').fill('3')
  await f.getByRole('button', { name: 'Criar campanha' }).click()
  await expect(f.getByText('O 2º lembrete vem depois do 1º')).toBeVisible()
  await f.getByLabel('1º lembrete (dias depois)').fill('3')
  await f.getByLabel('2º lembrete (dias depois)').fill('7')
  await f.getByLabel(/Modelo do passo 1/).selectOption({ label: 'Passo 1' })
  await f.getByLabel(/Modelo do passo 2/).selectOption({ label: 'Passo 2' })
  await f.getByLabel(/Modelo do passo 3/).selectOption({ label: 'Passo 3' })
  await f.getByLabel('Sistema', { exact: true }).selectOption({ label: 'Sistema de pedidos' })
  await f.getByRole('button', { name: 'Criar campanha' }).click()
  await expect(f.getByRole('heading', { name: 'Pedidos — novembro' })).toBeVisible()

  // Em rascunho: não gera rascunhos; ativar libera.
  await f.getByRole('tab', { name: /^Leads/ }).click()
  await f.getByRole('button', { name: 'Incluir leads' }).click()
  await expect(f.getByText(/2 leads podem entrar nesta campanha/)).toBeVisible()
  await expect(f.getByText(/1 sem e-mail\/telefone para o canal/)).toBeVisible()
  await expect(f.getByRole('button', { name: 'Incluir e gerar rascunhos' })).toBeDisabled()
  await f.getByRole('button', { name: 'Ativar' }).click()
  await expect(f.getByText('Campanha ativa.').filter({ visible: true })).toBeVisible()
  await expect(f.getByRole('button', { name: 'Incluir e gerar rascunhos' })).toBeEnabled()
  await f.getByRole('button', { name: 'Incluir e gerar rascunhos' }).click()
  await expect(f.getByText(/2 leads incluídos/)).toBeVisible({ timeout: 20_000 })
  await expect(f.getByText(/Rascunhos do passo 1 gerados na fila/)).toBeVisible()

  // Os rascunhos estão na fila, ligados à campanha, e o próximo lembrete é D+3.
  const drafts = await client.from('outbound_messages').select('status, body, campaign_id').eq('status', 'draft')
  expect(drafts.data).toHaveLength(2)
  expect(drafts.data!.every((d) => d.campaign_id)).toBe(true)
  expect(drafts.data!.find((d) => d.body.includes('que vocês entregam no bairro'))).toBeTruthy()
  const cls = await client.from('campaign_leads').select('step, status, started_on, next_step_on').eq('status', 'active')
  expect(cls.data).toHaveLength(2)
  for (const cl of cls.data!) {
    expect(cl.step).toBe(1)
    const days = (new Date(cl.next_step_on!).getTime() - new Date(cl.started_on!).getTime()) / 86_400_000
    expect(days).toBe(3)
  }

  // Quem respondeu sai da sequência.
  await page.getByRole('tab', { name: /^Leads/ }).click()
  await expect(page.getByText('Passo 1 de 3').first()).toBeVisible()
  await page.getByRole('listitem').filter({ hasText: 'Alfa Padaria' }).getByRole('button', { name: 'Respondeu' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: 'Alfa Padaria' }).getByText('Respondeu', { exact: true })).toBeVisible()
  const replied = await client.from('campaign_leads').select('status, next_step_on').eq('status', 'replied')
  expect(replied.data).toHaveLength(1)
  expect(replied.data![0].next_step_on).toBeNull()

  // Pausa: o banco recusa rascunho de campanha pausada.
  await page.getByRole('button', { name: 'Pausar' }).click()
  await expect(page.getByText('Campanha pausada: não gera rascunhos.').filter({ visible: true })).toBeVisible()
  const camp = await client.from('campaigns').select('id, status, step1_template_id').single()
  expect(camp.data!.status).toBe('paused')
  const lead = await client.from('leads').select('id').eq('company_name', 'Beta Clínica').single()
  const blocked = await client.from('outbound_messages').insert({
    organization_id: orgId,
    campaign_id: camp.data!.id,
    lead_id: lead.data!.id,
    template_id: camp.data!.step1_template_id,
    channel: 'email',
    subject: 'x',
    body: 'y',
  })
  expect(blocked.error).not.toBeNull()
  await page.getByRole('tab', { name: /Rascunhos a gerar/ }).click()
  await expect(page.getByText('Nada a gerar agora')).toBeVisible()

  // Lista de campanhas e encerramento.
  await page.goto('/app/prospeccao/campanhas')
  await expect(page.getByRole('link', { name: /Pedidos — novembro/ })).toBeVisible()
  await expect(page.getByText('Pausada', { exact: true })).toBeVisible()
})

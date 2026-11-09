import { expect, test } from '@playwright/test'
import { apiSessionFor, createUser, login, panel } from './helpers'

test('fila: gerar rascunhos por modelo, revisar, editar, aprovar em lote e regras do banco', async ({ page }) => {
  test.setTimeout(150_000)
  const user = await createUser('outreach-queue')
  const { client, orgId } = await apiSessionFor(user)
  const base = { organization_id: orgId, source: 'teste' }
  await client.from('leads').insert([
    { ...base, company_name: 'Alfa Padaria', contact_name: 'Maria Souza', email: 'alfa@ex.com', hook: 'que vocês fazem entrega no bairro' },
    { ...base, company_name: 'Beta Clínica', email: 'beta@ex.com' },
    { ...base, company_name: 'Gama Sem Email', phone: '+5511911111111' },
    { ...base, company_name: 'Delta Saiu', email: 'delta@ex.com', opted_out_at: new Date().toISOString() },
    { ...base, company_name: 'Epsilon Suprimido', email: 'sup@ex.com' },
  ])
  await client.from('suppression_list').insert({ organization_id: orgId, channel: 'email', value: 'sup@ex.com', reason: 'manual' })
  const product = await client.from('products').insert({ organization_id: orgId, name: 'Sistema de pedidos', value_proposition: 'cardápio digital sem taxa' }).select('id').single()
  await client.from('message_templates').insert({
    organization_id: orgId,
    product_id: product.data!.id,
    name: 'Primeiro contato',
    channel: 'email',
    step: 1,
    subject: 'Uma ideia para a {{empresa}}',
    body: 'Olá {{contato}} vi {{gancho}}. O {{sistema}} traz {{proposta}}. Faz sentido?',
    openings: ['Oi', 'Olá'],
    closings: ['Abraço'],
  })
  await client.from('message_templates').insert({
    organization_id: orgId,
    name: 'Zap quente',
    channel: 'whatsapp',
    temperature: 'hot',
    step: 1,
    body: 'Oi {{contato}}, posso te mandar um exemplo?',
  })

  await login(page, user)
  await page.goto('/app/prospeccao/fila')
  await expect(page.getByRole('heading', { level: 1, name: 'Fila' })).toBeVisible()
  await expect(page.getByText('Nenhum rascunho para revisar')).toBeVisible()

  // Gerar: só os elegíveis; os demais aparecem com o motivo.
  await page.getByRole('button', { name: 'Gerar rascunhos' }).first().click()
  const gen = page.getByRole('region', { name: 'Gerar rascunhos' })
  await gen.getByLabel('Modelo', { exact: true }).selectOption({ label: 'Primeiro contato · E-mail · passo 1' })
  await expect(gen.getByText(/2 leads podem receber este modelo/)).toBeVisible()
  await expect(gen.getByText(/1 sem e-mail\/telefone para o canal/)).toBeVisible()
  await expect(gen.getByText(/1 marcado como "não contatar"/)).toBeVisible()
  await expect(gen.getByText(/1 na lista de supressão/)).toBeVisible()
  await expect(gen.getByText('sem gancho', { exact: true })).toHaveCount(1) // Beta não tem gancho
  await gen.getByRole('button', { name: 'Gerar 2 rascunhos' }).click()
  await expect(gen.getByText(/2 rascunhos criados/)).toBeVisible()

  // Gerar de novo: ninguém sobra (já estão na fila).
  await gen.getByLabel('Modelo', { exact: true }).selectOption('')
  await gen.getByLabel('Modelo', { exact: true }).selectOption({ label: 'Primeiro contato · E-mail · passo 1' })
  await expect(gen.getByText(/0 leads podem receber este modelo/)).toBeVisible()
  await expect(gen.getByText(/2 já tem este modelo na fila/)).toBeVisible()

  // WhatsApp só para quente: nenhum lead é elegível aqui (ninguém é quente com telefone).
  await gen.getByLabel('Modelo', { exact: true }).selectOption({ label: 'Zap quente · WhatsApp · passo 1' })
  await expect(gen.getByText(/0 leads podem receber este modelo/)).toBeVisible()
  await gen.getByRole('button', { name: 'Fechar' }).click()

  // Revisão de um rascunho: o texto vem do lead; edita e aprova.
  await page.reload()
  await expect(page.getByRole('link', { name: /Alfa Padaria/ })).toBeVisible()
  await page.getByRole('link', { name: /Alfa Padaria/ }).click()
  const m = panel(page)
  await expect(m.getByLabel('Assunto')).toHaveValue('Uma ideia para a Alfa Padaria')
  const body = m.getByLabel('Mensagem', { exact: true })
  await expect(body).toContainText('que vocês fazem entrega no bairro')
  await expect(body).toContainText('Sistema de pedidos')
  await body.fill('Oi Maria, vi que vocês entregam no bairro. Faz sentido conversar?')
  await m.getByRole('button', { name: 'Salvar edição' }).click()
  await expect(m.getByText('Alterações salvas.')).toBeVisible()
  await m.getByRole('button', { name: 'Aprovar' }).click()
  await expect(m.getByText('Mensagem aprovada. Nada foi enviado.')).toBeVisible()
  await expect(m.getByLabel('Mensagem', { exact: true })).toBeDisabled() // aprovada não se edita
  await m.getByRole('button', { name: 'Voltar para rascunho' }).click()
  await expect(m.getByText('Voltou para rascunho.')).toBeVisible()

  // Em lote: a lista de rascunhos tem 2; aprova os dois (a Beta sem gancho segue com aviso na revisão).
  await page.goto('/app/prospeccao/fila')
  await page.getByLabel('Selecionar todas', { exact: false }).check()
  await expect(page.getByText('2 selecionadas')).toBeVisible()
  await page.getByRole('button', { name: 'Aprovar selecionadas' }).click()
  await expect(page.getByText(/2 mensagens aprovada\(s\)/)).toBeVisible()
  await page.getByLabel('Situação').selectOption('approved')
  await expect(page.getByRole('link', { name: /Beta Clínica/ })).toBeVisible()

  // O banco impede aprovar depois que o lead entra na supressão.
  await page.getByLabel('Situação').selectOption('approved')
  await page.getByLabel('Selecionar todas', { exact: false }).check()
  await page.getByRole('button', { name: 'Voltar para rascunho' }).click()
  await expect(page.getByText(/2 mensagens devolvida\(s\) para rascunho/)).toBeVisible()
  await client.from('suppression_list').insert({ organization_id: orgId, channel: 'email', value: 'beta@ex.com', reason: 'manual' })
  await page.getByLabel('Situação').selectOption('draft')
  await page.getByLabel('Selecionar todas', { exact: false }).check()
  await page.getByRole('button', { name: 'Aprovar selecionadas' }).click()
  await expect(page.getByText(/1 mensagem aprovada\(s\); 1 barrada pelo banco/)).toBeVisible()

  // O servidor é quem marca "enviando/enviada": o cliente não consegue.
  const msg = await client.from('outbound_messages').select('id').eq('status', 'approved').single()
  const forbidden = await client.from('outbound_messages').update({ status: 'sent' }).eq('id', msg.data!.id)
  expect(forbidden.error).not.toBeNull()

  // Central do dia: o que aguarda aprovação.
  await page.goto('/app')
  await expect(page.getByRole('heading', { name: 'Aguardando aprovação' })).toBeVisible()
})

import { expect, test } from '@playwright/test'
import { apiSessionFor, createUser, login, panel } from './helpers'

test('sistemas e modelos: cadastrar, avisos de estilo, variação por lead e regra do WhatsApp', async ({ page }) => {
  test.setTimeout(150_000)
  const user = await createUser('outreach-tpl')
  const { client, orgId } = await apiSessionFor(user)
  await client.from('leads').insert([
    { organization_id: orgId, company_name: 'Alfa Padaria', source: 'teste', hook: 'que vocês fazem entrega no bairro' },
    { organization_id: orgId, company_name: 'Beta Clínica', source: 'teste', contact_name: 'Dra. Ana Lima' },
  ])
  await login(page, user)

  // Sistemas: lista vazia → cadastrar.
  await page.goto('/app/prospeccao/sistemas')
  await expect(page.getByRole('heading', { level: 1, name: 'Sistemas' })).toBeVisible()
  await expect(page.getByText('Nenhum sistema encontrado')).toBeVisible()
  await page.getByRole('link', { name: 'Novo sistema' }).first().click()
  const p1 = panel(page)
  await p1.getByLabel('Nome do sistema *').fill('Sistema de pedidos')
  await p1.getByLabel('Proposta de valor').fill('cardápio digital sem taxa por pedido')
  await p1.getByLabel('Endereço da demonstração').fill('javascript:alert(1)')
  await p1.getByRole('button', { name: 'Criar sistema' }).click()
  await expect(p1.getByText('Use um endereço que comece com http:// ou https://')).toBeVisible()
  await p1.getByLabel('Endereço da demonstração').fill('https://demo.exemplo.com')
  await p1.getByRole('button', { name: 'Criar sistema' }).click()
  await expect(p1.getByRole('heading', { name: 'Sistema de pedidos' })).toBeVisible()
  await page.goto('/app/prospeccao/sistemas')
  await expect(page.getByRole('link', { name: /Sistema de pedidos/ })).toBeVisible()

  // Modelos: novo modelo de e-mail com problemas de estilo propositais.
  await page.goto('/app/prospeccao/modelos')
  await expect(page.getByText('Nenhum modelo encontrado')).toBeVisible()
  await page.getByRole('link', { name: 'Novo modelo' }).first().click()
  const m = panel(page)
  await m.getByLabel('Nome do modelo *').fill('Primeiro contato — pedidos')
  await m.getByLabel('Sistema', { exact: true }).selectOption({ label: 'Sistema de pedidos' })
  await m.getByLabel('Assunto *').fill('Uma ideia para a {{empresa}}')
  await m.getByLabel('Mensagem *').fill('{{contato}} vi {{gancho}}. O {{sistema}} traz {{proposta}}. Veja https://exemplo.com. Faz sentido? Posso ligar?')
  await m.getByLabel('Aberturas (uma por linha)').fill('Oi\nOlá\nBom dia')
  await m.getByLabel('Fechamentos (uma por linha)').fill('Abraço\nAté mais')

  const avisos = m.getByRole('list', { name: 'Avisos do modelo' })
  await expect(avisos.getByText(/Link na primeira mensagem/)).toBeVisible()
  await expect(avisos.getByText(/Mais de uma pergunta/)).toBeVisible()

  // Pré-visualização com lead real: o texto vem do lead e o aviso de "sem gancho" aparece no lead sem gancho.
  const preview = m.getByLabel('Lead para a pré-visualização')
  await preview.selectOption({ label: 'Alfa Padaria' })
  const body = m.getByTestId('preview-body')
  await expect(body).toContainText('que vocês fazem entrega no bairro')
  await expect(body).toContainText('Sistema de pedidos')
  const alfa = (await body.innerText()).trim()
  await preview.selectOption({ label: 'Beta Clínica' })
  await expect(body).toContainText('Dra.')
  await expect(m.getByLabel('Avisos de estilo').getByText(/sem gancho/)).toBeVisible()
  await preview.selectOption({ label: 'Alfa Padaria' })
  expect((await body.innerText()).trim()).toBe(alfa) // o mesmo lead sempre vê o mesmo texto

  await m.getByRole('button', { name: 'Criar modelo' }).click()
  await expect(m.getByRole('heading', { name: 'Primeiro contato — pedidos' })).toBeVisible()
  await page.goto('/app/prospeccao/modelos')
  await expect(page.getByRole('link', { name: /Primeiro contato — pedidos/ })).toBeVisible()

  // Regra do WhatsApp (D105): sem público morno/quente o formulário recusa.
  await page.getByRole('link', { name: 'Novo modelo' }).first().click()
  const w = panel(page)
  await w.getByLabel('Nome do modelo *').fill('Zap')
  await w.getByLabel('Canal').selectOption('whatsapp')
  await w.getByLabel('Mensagem *').fill('Oi {{contato}}')
  await w.getByRole('button', { name: 'Criar modelo' }).click()
  await expect(w.getByText('WhatsApp é só para lead morno ou quente')).toBeVisible()
  await w.getByLabel('Para leads').selectOption('warm')
  await w.getByRole('button', { name: 'Criar modelo' }).click()
  await expect(w.getByRole('heading', { name: 'Zap' })).toBeVisible()

  // Filtro de canal na lista.
  await page.goto('/app/prospeccao/modelos')
  await page.getByLabel('Canal', { exact: true }).selectOption('whatsapp')
  await expect(page.getByRole('link', { name: /Zap/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Primeiro contato/ })).toHaveCount(0)

  // Sistema de interesse no lead.
  const lead = await client.from('leads').select('id').eq('company_name', 'Alfa Padaria').single()
  await page.goto(`/app/prospeccao/leads/${lead.data!.id}`)
  const l = panel(page)
  await l.getByLabel('Sistema de interesse').selectOption({ label: 'Sistema de pedidos' })
  await l.getByRole('button', { name: 'Salvar alterações' }).click()
  await expect(l.getByText('Alterações salvas.')).toBeVisible()
  const saved = await client.from('leads').select('product_id').eq('id', lead.data!.id).single()
  expect(saved.data!.product_id).toBeTruthy()
})

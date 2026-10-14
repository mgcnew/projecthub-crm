import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { apiSessionFor, createUser, login, panel } from './helpers'

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

async function expectNoViolations(page: Page, label: string) {
  await page.waitForLoadState('networkidle')
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze()
  expect(
    results.violations.map((v) => ({ rule: v.id, nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) })),
    `violações de acessibilidade em ${label}`,
  ).toEqual([])
}

test('financeiro: valor, gerar parcelas com adiantamento, receber, atraso, cliente e Central do dia', async ({ page, isMobile }) => {
  test.setTimeout(150_000)
  const user = await createUser('fin')
  const { client, orgId } = await apiSessionFor(user)
  const c = await client.from('clients').insert({ organization_id: orgId, name: 'Cliente Alfa' }).select('id').single()
  const p = await client
    .from('projects')
    .insert({ organization_id: orgId, name: 'Projeto Beta', client_id: c.data!.id })
    .select('id')
    .single()
  const projectId = p.data!.id as string
  const clientId = c.data!.id as string

  await login(page, user)
  const root = () => (isMobile ? page : panel(page))

  // Valor do projeto (aba Detalhes).
  await page.goto(`/app/projetos/${projectId}`)
  await root().getByLabel('Valor do projeto').fill('5.000,00')
  await root().getByRole('button', { name: 'Salvar alterações' }).click()
  await expect(root().getByText('Alterações salvas.')).toBeVisible()

  // Gerar: 30% de adiantamento + 3 parcelas.
  await page.goto(`/app/projetos/${projectId}?aba=financeiro`)
  await expect(root().getByText('Nenhuma parcela')).toBeVisible()
  await root().getByRole('button', { name: 'Gerar parcelas' }).click()
  await expect(root().getByLabel(/Valor total/)).toHaveValue('5000,00')
  await root().getByRole('button', { name: 'Gerar parcelas' }).last().click()

  await expect(root().getByText('Adiantamento (30%)')).toBeVisible()
  await expect(root().getByText('Parcela 1/3')).toBeVisible()
  await expect(root().getByText('Parcela 2/3')).toBeVisible()
  await expect(root().getByText('Parcela 3/3')).toBeVisible()
  await expect(root().getByText(/R\$\s*1\.500,00/).first()).toBeVisible()

  // Receber o adiantamento.
  const advance = root().getByRole('listitem').filter({ hasText: 'Adiantamento (30%)' })
  await advance.getByRole('button', { name: 'Marcar como recebida' }).click()
  await advance.getByRole('button', { name: 'Confirmar recebimento' }).click()
  await expect(advance.getByText(/Recebida em/)).toBeVisible()
  await expect(root().getByRole('term').filter({ hasText: 'Recebido' })).toBeVisible()

  await expectNoViolations(page, 'financeiro do projeto')

  // Moeda fica fixa com parcelas.
  await page.goto(`/app/projetos/${projectId}`)
  await expect(root().getByLabel('Moeda')).toBeDisabled()

  // Parcela vencida (criada pela API) vira "Atrasada" e aparece na Central do dia.
  await client.from('project_payments').insert({
    organization_id: orgId,
    project_id: projectId,
    kind: 'other',
    description: 'Hospedagem anual',
    amount_cents: 20000,
    due_date: '2020-01-10',
  })
  await page.goto(`/app/projetos/${projectId}?aba=financeiro`)
  await expect(root().getByText(/Atrasada há/)).toBeVisible()

  await page.goto('/app')
  const plate = page.getByRole('region', { name: 'A receber' })
  await expect(plate).toBeVisible()
  await expect(plate.getByText('Hospedagem anual')).toBeVisible()
  await expect(plate.getByText(/Atrasada/)).toBeVisible()

  // Aba Financeiro do cliente.
  await page.goto(`/app/clientes/${clientId}?aba=financeiro`)
  await expect(root().getByRole('link', { name: 'Projeto Beta' })).toBeVisible()
  await expect(root().getByText(/em atraso/).first()).toBeVisible()
})

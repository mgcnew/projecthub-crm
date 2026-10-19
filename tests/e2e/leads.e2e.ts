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

test('prospecção: cadastrar lead, duplicado, temperatura, etapa, não contatar e isolamento', async ({ page, isMobile }) => {
  test.setTimeout(150_000)
  const user = await createUser('leads')
  const other = await createUser('leads-b')
  const sb = await apiSessionFor(other)
  const foreign = await sb.client
    .from('leads')
    .insert({ organization_id: sb.orgId, company_name: 'Lead do outro', source: 'x' })
    .select('id')
    .single()

  await login(page, user)
  const root = () => (isMobile ? page : panel(page))

  await page.goto('/app/prospeccao')
  await expect(page.getByRole('heading', { level: 1, name: 'Prospecção' })).toBeVisible()
  await expect(page.getByText('Nenhum lead encontrado')).toBeVisible()
  await expectNoViolations(page, 'prospecção (vazia)')

  // Cadastro com telefone normalizado.
  await page.goto('/app/prospeccao/leads/novo')
  await root().getByLabel('Empresa *').fill('Padaria Sol')
  await root().getByLabel('Contato', { exact: true }).fill('Ana')
  await root().getByLabel('E-mail').fill('Contato@PadariaSol.com.br')
  await root().getByLabel('Telefone').fill('11 91234-5678')
  await root().getByLabel('Gancho').fill('Cardápio só em PDF no site')
  await root().getByRole('button', { name: 'Criar lead' }).click()
  await expect(root().getByText('Informe a origem')).toBeVisible()
  await root().getByLabel('Origem *').fill('Planilha out/2026')
  await root().getByRole('button', { name: 'Criar lead' }).click()
  await expect(root().getByRole('heading', { name: 'Padaria Sol' })).toBeVisible()
  await expect(root().getByLabel('Telefone')).toHaveValue('(11) 91234-5678')
  await expect(root().getByLabel('E-mail')).toHaveValue('contato@padariasol.com.br')
  await expect(root().getByText('Frio', { exact: true }).first()).toBeVisible()
  await expectNoViolations(page, 'lead (detalhe)')

  // Duplicado por e-mail é recusado com mensagem clara.
  await page.goto('/app/prospeccao/leads/novo')
  await root().getByLabel('Empresa *').fill('Outra Padaria')
  await root().getByLabel('E-mail').fill('CONTATO@padariasol.com.br')
  await root().getByLabel('Origem *').fill('Indicação')
  await root().getByRole('button', { name: 'Criar lead' }).click()
  await expect(root().getByRole('alert')).toHaveText('Já existe um lead com este e-mail.')

  // Temperatura e etapa; motivo da perda só em "Perdido".
  await page.goto('/app/prospeccao')
  await page.getByRole('link', { name: /Padaria Sol/ }).click()
  await root().getByLabel('Temperatura').selectOption({ label: 'Morno' })
  await root().getByLabel('Etapa').selectOption({ label: 'Perdido' })
  await expect(root().getByLabel('Motivo da perda')).toBeVisible()
  await root().getByLabel('Etapa').selectOption({ label: 'Respondeu' })
  await expect(root().getByLabel('Motivo da perda')).toHaveCount(0)
  await root().getByRole('button', { name: 'Salvar alterações' }).click()
  await expect(root().getByText('Alterações salvas.')).toBeVisible()

  // Filtro por temperatura (no celular os filtros ficam atrás do botão "Filtros").
  await page.goto('/app/prospeccao')
  if (isMobile) await page.getByRole('button', { name: /^Filtros/ }).click()
  await page.getByLabel('Temperatura').selectOption({ label: 'Quente' })
  await expect(page.getByText('Nenhum lead encontrado')).toBeVisible()
  await page.getByLabel('Temperatura').selectOption({ label: 'Morno' })
  await expect(page.getByRole('link', { name: /Padaria Sol/ })).toBeVisible()

  // Não contatar e reativar (com confirmação).
  await page.getByRole('link', { name: /Padaria Sol/ }).click()
  await root().getByRole('button', { name: 'Não contatar' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Não contatar' }).click()
  await expect(root().getByRole('status').filter({ hasText: 'Marcado como "não contatar"' })).toBeVisible()
  await root().getByRole('button', { name: 'Reativar contato' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Reativar contato' }).click()
  await expect(root().getByRole('button', { name: 'Não contatar' })).toBeVisible()

  // Lead de outra organização não abre.
  await page.goto(`/app/prospeccao/leads/${foreign.data!.id}`)
  await expect(root().getByText('Lead não encontrado.')).toBeVisible()
})

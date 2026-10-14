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

test('relacionamento: próximo contato, interações com contato e documentos por link', async ({ page, context, isMobile }) => {
  test.setTimeout(150_000)
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const user = await createUser('rel')
  const { client, orgId } = await apiSessionFor(user)
  const c = await client.from('clients').insert({ organization_id: orgId, name: 'Cliente Delta' }).select('id').single()
  const clientId = c.data!.id as string
  await client.from('client_contacts').insert({ organization_id: orgId, client_id: clientId, name: 'Carla Souza' })
  const root = () => (isMobile ? page : panel(page))

  await login(page, user)

  // Próximo contato (data passada = atrasado) e a placa na Central do dia.
  await page.goto(`/app/clientes/${clientId}?aba=interacoes`)
  const interactions = () => root().getByRole('tabpanel', { name: 'Interações' })
  await expect(interactions().getByText('Nenhum contato agendado.')).toBeVisible()
  await interactions().getByRole('button', { name: 'Agendar' }).click()
  await interactions().getByLabel('Data *').fill('2020-01-15')
  await interactions().getByLabel('O que fazer').fill('Cobrar retorno da proposta')
  await interactions().getByRole('button', { name: 'Salvar', exact: true }).click()
  await expect(interactions().getByText('Atrasado')).toBeVisible()
  await expect(interactions().getByText('Cobrar retorno da proposta')).toBeVisible()

  // Interação com contato.
  await expect(interactions().getByText('Nenhuma interação')).toBeVisible()
  await interactions().getByRole('button', { name: 'Registrar interação' }).click()
  await interactions().getByLabel('Com quem').selectOption({ label: 'Carla Souza' })
  await interactions().getByLabel('O que foi tratado *').fill('Alinhou escopo e prazo de entrega')
  await interactions().getByRole('button', { name: 'Registrar', exact: true }).click()
  const item = interactions().getByRole('listitem').filter({ hasText: 'Alinhou escopo e prazo de entrega' })
  await expect(item.getByText('com Carla Souza')).toBeVisible()
  await expect(item.getByText('Ligação')).toBeVisible()
  await expectNoViolations(page, 'cliente (interações)')

  // Editar e excluir.
  await item.getByRole('button', { name: 'Editar' }).click()
  await interactions().getByLabel('O que foi tratado *').fill('Escopo fechado')
  await interactions().getByRole('button', { name: 'Salvar', exact: true }).click()
  await expect(interactions().getByText('Escopo fechado')).toBeVisible()
  await interactions().getByRole('listitem').filter({ hasText: 'Escopo fechado' }).getByRole('button', { name: 'Excluir' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Excluir interação' }).click()
  await expect(interactions().getByText('Escopo fechado')).toHaveCount(0)

  // Central do dia mostra o contato atrasado.
  await page.goto('/app')
  const plate = page.getByRole('region', { name: 'Contatos a fazer' })
  await expect(plate.getByText('Cliente Delta')).toBeVisible()
  await expect(plate.getByText(/Atrasado/)).toBeVisible()

  // Documentos.
  await page.goto(`/app/clientes/${clientId}?aba=documentos`)
  const docs = () => root().getByRole('tabpanel', { name: 'Documentos' })
  await expect(docs().getByText('Nenhum documento')).toBeVisible()
  await docs().getByRole('button', { name: 'Novo documento' }).click()
  await docs().getByLabel('Título *').fill('Contrato assinado')
  await docs().getByLabel('Endereço do documento *').fill('javascript:alert(1)')
  await docs().getByRole('button', { name: 'Adicionar documento' }).click()
  await expect(docs().getByText('Use um endereço que comece com http:// ou https://')).toBeVisible()
  await docs().getByLabel('Endereço do documento *').fill('https://drive.google.com/file/d/abc')
  await docs().getByLabel('Tipo').selectOption({ label: 'Contrato' })
  await docs().getByRole('button', { name: 'Adicionar documento' }).click()

  const link = docs().getByRole('link', { name: 'Abrir Contrato assinado em nova aba' })
  await expect(link).toHaveAttribute('href', 'https://drive.google.com/file/d/abc')
  await expect(link).toHaveAttribute('target', '_blank')
  await expect(link).toHaveAttribute('rel', /noopener/)
  await docs().getByRole('button', { name: 'Copiar o link de Contrato assinado' }).click()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('https://drive.google.com/file/d/abc')
  await expectNoViolations(page, 'cliente (documentos)')

  await docs().getByRole('listitem').filter({ hasText: 'Contrato assinado' }).getByRole('button', { name: 'Excluir' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Excluir documento' }).click()
  await expect(docs().getByText('Nenhum documento')).toBeVisible()
})

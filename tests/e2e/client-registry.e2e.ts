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

test('cliente: cadastro completo com CPF/CNPJ e contatos com principal, e-mail e WhatsApp', async ({ page, context, isMobile }) => {
  test.setTimeout(120_000)
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const user = await createUser('reg')
  const { client, orgId } = await apiSessionFor(user)
  const c = await client.from('clients').insert({ organization_id: orgId, name: 'Cliente Gama' }).select('id').single()
  const clientId = c.data!.id as string
  const root = () => (isMobile ? page : panel(page))

  await login(page, user)

  // Detalhes: documento inválido é recusado; válido é salvo formatado.
  await page.goto(`/app/clientes/${clientId}`)
  await root().getByLabel('CPF ou CNPJ').fill('11222333000180')
  await root().getByRole('button', { name: 'Salvar alterações' }).click()
  await expect(root().getByText('CPF ou CNPJ inválido')).toBeVisible()

  await root().getByLabel('CPF ou CNPJ').fill('11222333000181')
  await root().getByLabel('Razão social').fill('Gama Serviços Ltda')
  await root().getByLabel('E-mail de cobrança').fill('financeiro@gama.com')
  await root().getByLabel('Cidade').fill('Curitiba')
  await root().getByLabel('Estado').fill('PR')
  await root().getByLabel('CEP').fill('80000-000')
  await root().getByLabel('Origem').fill('Indicação')
  await root().getByRole('button', { name: 'Salvar alterações' }).click()
  await expect(root().getByText('Alterações salvas.')).toBeVisible()
  await page.reload()
  await expect(root().getByLabel('CPF ou CNPJ')).toHaveValue('11.222.333/0001-81')
  await expectNoViolations(page, 'cliente (detalhes)')

  // Contatos (o painel de Detalhes continua montado, então os campos são buscados no painel desta aba).
  const tab = () => root().getByRole('tabpanel', { name: 'Contatos' })
  await page.goto(`/app/clientes/${clientId}?aba=contatos`)
  await expect(tab().getByText('Nenhum contato')).toBeVisible()
  await tab().getByRole('button', { name: 'Novo contato' }).click()
  await tab().getByLabel('Nome *').fill('Ana Lima')
  await tab().getByLabel('Cargo').fill('Diretora')
  await tab().getByLabel('E-mail', { exact: true }).fill('ana@gama.com')
  await tab().getByLabel('WhatsApp').fill('(41) 99999-1234')
  await tab().getByRole('button', { name: 'Adicionar contato' }).click()

  const ana = tab().getByRole('listitem').filter({ hasText: 'Ana Lima' })
  await expect(ana.getByText('Principal')).toBeVisible()
  await expect(ana.getByRole('link', { name: 'Enviar e-mail para Ana Lima' })).toHaveAttribute('href', 'mailto:ana@gama.com')
  const wa = ana.getByRole('link', { name: /WhatsApp de Ana Lima/ })
  await expect(wa).toHaveAttribute('href', 'https://wa.me/5541999991234')
  await expect(wa).toHaveAttribute('rel', /noopener/)
  await ana.getByRole('button', { name: 'Copiar o e-mail de Ana Lima' }).click()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('ana@gama.com')
  await expectNoViolations(page, 'cliente (contatos)')

  // Um segundo principal desmarca o primeiro.
  await tab().getByRole('button', { name: 'Novo contato' }).click()
  await tab().getByLabel('Nome *').fill('Bruno Reis')
  await tab().getByLabel('Contato principal deste cliente').check()
  await tab().getByRole('button', { name: 'Adicionar contato' }).click()
  const bruno = tab().getByRole('listitem').filter({ hasText: 'Bruno Reis' })
  await expect(bruno.getByText('Principal')).toBeVisible()
  await expect(tab().getByRole('listitem').filter({ hasText: 'Ana Lima' }).getByText('Principal')).toHaveCount(0)

  // Excluir (confirma).
  await bruno.getByRole('button', { name: 'Excluir' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Excluir contato' }).click()
  await expect(tab().getByText('Bruno Reis')).toHaveCount(0)
})

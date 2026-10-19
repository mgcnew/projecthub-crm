import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { apiSessionFor, createUser, login } from './helpers'

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

/** Planilha como o Excel pt-BR exporta: `;` e Windows-1252 (acentos). 20 linhas de dados. */
function sheet() {
  const lines = ['Nome da Empresa;Telefone;E-mail;Site;Endereço;Cidade;UF;Ramo']
  for (let i = 1; i <= 15; i += 1) {
    lines.push(`Empresa ${i};(11) 9${String(1000 + i).padStart(4, '0')}-${String(2000 + i).padStart(4, '0')};contato${i}@exemplo.com;empresa${i}.com.br;Rua ${i};São Paulo;sp;Padaria`)
  }
  lines.push('Mercado Já Cadastrado;;existente@exemplo.com;;;Santos;SP;Mercado') // já existe (e-mail)
  lines.push('Empresa 1 repetida;(11) 91001-2001;;;;;;') // repetida no arquivo (telefone da Empresa 1)
  lines.push('Empresa 2 repetida;;CONTATO2@exemplo.com;;;;;') // repetida no arquivo (e-mail da Empresa 2)
  lines.push(';(11) 3456-7890;sem-empresa@exemplo.com;;;;;') // inválida: sem empresa
  lines.push('Bar Telefone Ruim;1234;;;;;;') // inválida: telefone
  return Buffer.from(lines.join('\r\n'), 'latin1')
}

test('importar planilha: mapeia colunas, ignora duplicados, aponta erros e completa existentes', async ({ page }) => {
  test.setTimeout(150_000)
  const user = await createUser('import')
  const { client, orgId } = await apiSessionFor(user)
  await client.from('leads').insert({ organization_id: orgId, company_name: 'Mercado Já Cadastrado', email: 'existente@exemplo.com', source: 'Manual' })

  await login(page, user)
  await page.goto('/app/prospeccao')
  await page.getByRole('link', { name: 'Importar planilha' }).first().click()
  await expect(page.getByRole('heading', { level: 1, name: 'Importar leads' })).toBeVisible()

  await page.getByLabel('Planilha (CSV)').setInputFiles({ name: 'leads-outubro.csv', mimeType: 'text/csv', buffer: sheet() })
  await expect(page.getByText('2. Colunas · 20 linhas')).toBeVisible()
  // Sugestão automática das colunas (inclusive com acento vindo do Windows-1252).
  await expect(page.getByLabel('Coluna "Nome da Empresa"')).toHaveValue('company_name')
  await expect(page.getByLabel('Coluna "Endereço"')).toHaveValue('address_line')
  await expect(page.getByLabel('Coluna "Ramo"')).toHaveValue('segment')
  await expect(page.getByLabel('Origem desta lista *')).toHaveValue('leads-outubro')

  const a11y = await new AxeBuilder({ page }).withTags(TAGS).analyze()
  expect(a11y.violations.map((v) => v.id), 'acessibilidade da importação').toEqual([])

  await page.getByRole('button', { name: 'Revisar importação' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'novos' })).toHaveText('15 novos · 0 a completar · 3 ignorados · 2 com erro')
  await page.getByText('Linhas com erro (2)').click()
  await expect(page.getByText('Linha 20: Sem o nome da empresa')).toBeVisible()
  await expect(page.getByText(/Linha 21: Telefone inválido/)).toBeVisible()

  await page.getByRole('button', { name: 'Importar 15 leads' }).click()
  await expect(page.getByRole('heading', { name: 'Importação concluída' })).toBeVisible()
  await expect(page.getByRole('definition').first()).toHaveText('15')

  // Os leads entraram frios, com origem e dados normalizados.
  const { data } = await client.from('leads').select('company_name, phone, website, state, temperature, source').eq('company_name', 'Empresa 3').single()
  expect(data).toMatchObject({ phone: '+5511910032003', website: 'https://empresa3.com.br', state: 'SP', temperature: 'cold', source: 'leads-outubro' })

  // Segunda planilha no modo "completar": preenche só o que está vazio no lead já cadastrado.
  await page.getByRole('button', { name: 'Importar outra planilha' }).click()
  await page.getByLabel('Planilha (CSV)').setInputFiles({
    name: 'complemento.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('Empresa,E-mail,Cidade,Segmento\nMercado Já Cadastrado,existente@exemplo.com,Santos,Mercado\n', 'utf8'),
  })
  await page.getByLabel('Completar o lead cadastrado').check()
  await page.getByRole('button', { name: 'Revisar importação' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'novos' })).toHaveText('0 novos · 1 a completar · 0 ignorados · 0 com erro')
  await page.getByRole('button', { name: 'Importar 1 lead' }).click()
  await expect(page.getByRole('heading', { name: 'Importação concluída' })).toBeVisible()
  const merged = await client.from('leads').select('city, segment, source').eq('email', 'existente@exemplo.com').single()
  expect(merged.data).toEqual({ city: 'Santos', segment: 'Mercado', source: 'Manual' })

  // Histórico das duas importações.
  await expect(page.getByText('leads-outubro.csv')).toBeVisible()
  await expect(page.getByText('complemento.csv')).toBeVisible()
})

test('arquivo que não é CSV é recusado com orientação', async ({ page }) => {
  const user = await createUser('import-bad')
  await login(page, user)
  await page.goto('/app/prospeccao/importar')
  await page.getByLabel('Planilha (CSV)').setInputFiles({ name: 'leads.xlsx', mimeType: 'application/octet-stream', buffer: Buffer.from('x') })
  await expect(page.getByText('Envie um arquivo .csv')).toBeVisible()
})

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

test('acessos: cadastrar, copiar com 1 clique, ver no projeto, arquivar e excluir', async ({ page, context, isMobile }) => {
  test.setTimeout(120_000)
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const user = await createUser('access')
  const { client, orgId } = await apiSessionFor(user)
  const proj = await client.from('projects').insert({ organization_id: orgId, name: 'Projeto Alfa' }).select('id').single()
  const projectId = proj.data!.id as string

  await login(page, user)
  await page.goto('/app/acessos')
  await expect(page.getByRole('heading', { level: 1, name: 'Acessos' })).toBeVisible()
  await expect(page.getByText('Nenhum acesso encontrado')).toBeVisible()
  await expectNoViolations(page, 'acessos (vazio)')

  // Cadastro. No desktop abre em painel; no celular é página inteira.
  await page.goto('/app/acessos/novo')
  const root = isMobile ? page : panel(page)
  await expect(root.getByRole('heading', { name: 'Novo acesso' })).toBeVisible()
  await expect(root.getByText('Não guarde senhas aqui.')).toBeVisible()
  await expect(root.getByLabel(/senha$/i)).toHaveCount(0) // não existe campo de senha
  await expectNoViolations(page, 'novo acesso')

  await root.getByLabel('Serviço').fill('Supabase — painel')
  await root.getByLabel('Categoria').fill('Banco de dados')
  await root.getByLabel('Usuário ou e-mail').fill('eu@exemplo.com')
  await root.getByLabel('Item no gerenciador de senhas').fill('Supabase (pessoal)')
  await root.getByLabel('Projeto').selectOption(projectId)

  // URL que não é http(s) é recusada na tela.
  await root.getByLabel('Endereço (URL)').fill('javascript:alert(1)')
  await root.getByRole('button', { name: 'Criar acesso' }).click()
  await expect(root.getByText('Use um endereço que comece com http:// ou https://')).toBeVisible()

  await root.getByLabel('Endereço (URL)').fill('https://supabase.com/dashboard')
  await root.getByRole('button', { name: 'Criar acesso' }).click()
  await expect(root.getByRole('heading', { name: 'Supabase — painel' })).toBeVisible()

  // Lista: abrir (nova aba, sem opener) e copiar com 1 clique.
  await page.goto('/app/acessos')
  const row = page.getByRole('listitem').filter({ hasText: 'Supabase — painel' })
  const open = row.getByRole('link', { name: 'Abrir Supabase — painel em nova aba' })
  await expect(open).toHaveAttribute('href', 'https://supabase.com/dashboard')
  await expect(open).toHaveAttribute('target', '_blank')
  await expect(open).toHaveAttribute('rel', /noopener/)

  await row.getByRole('button', { name: 'Copiar usuário de Supabase — painel' }).click()
  await expect(page.getByText('Copiado para a área de transferência')).toBeAttached()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('eu@exemplo.com')

  await row.getByRole('button', { name: /Copiar o nome do item/ }).click()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('Supabase (pessoal)')
  await expectNoViolations(page, 'acessos (com itens)')

  // Busca e filtro por projeto.
  await page.getByLabel('Buscar acessos').fill('inexistente')
  await expect(page.getByText('Nenhum acesso encontrado')).toBeVisible()
  await page.getByLabel('Buscar acessos').fill('supabase')
  await expect(row).toBeVisible()

  // Aba "Acessos" do projeto.
  await page.goto(`/app/projetos/${projectId}?aba=acessos`)
  const projectRoot = isMobile ? page : panel(page)
  await expect(projectRoot.getByText('Supabase — painel')).toBeVisible()

  // Arquivar (confirma), restaurar, excluir (confirma).
  await page.goto('/app/acessos')
  await page.getByRole('link', { name: 'Supabase — painel' }).first().click()
  const detail = isMobile ? page : panel(page)
  await detail.getByRole('button', { name: 'Arquivar' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Arquivar acesso' }).click()
  await expect(detail.getByText('Acesso arquivado.')).toBeVisible()
  await detail.getByRole('button', { name: 'Restaurar' }).click()
  await expect(detail.getByText('Acesso restaurado.')).toBeVisible()

  await detail.getByRole('button', { name: 'Excluir' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Excluir acesso' }).click()
  await expect(page).toHaveURL(/\/app\/acessos$/)
  await expect(page.getByText('Nenhum acesso encontrado')).toBeVisible()
})

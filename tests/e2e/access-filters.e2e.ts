import { expect, test } from '@playwright/test'
import { apiSessionFor, createUser, login, panel } from './helpers'

test('acessos: filtrar por projeto, categoria e sem projeto; agrupar por projeto', async ({ page, isMobile }) => {
  test.setTimeout(120_000)
  const user = await createUser('access-filters')
  const { client, orgId } = await apiSessionFor(user)
  const alfa = await client.from('projects').insert({ organization_id: orgId, name: 'App Alfa' }).select('id').single()
  const beta = await client.from('projects').insert({ organization_id: orgId, name: 'Site Beta' }).select('id').single()
  const alfaId = alfa.data!.id as string
  const betaId = beta.data!.id as string
  const base = { organization_id: orgId, username: 'eu@exemplo.com' }
  await client.from('access_entries').insert([
    { ...base, name: 'Vercel Alfa', category: 'Hospedagem', project_id: alfaId },
    { ...base, name: 'Supabase Alfa', category: 'Banco de dados', project_id: alfaId },
    { ...base, name: 'Registro Beta', category: 'Domínio', project_id: betaId },
    { ...base, name: 'E-mail do estúdio', category: 'E-mail' },
  ])

  await login(page, user)
  await page.goto('/app/acessos')
  await expect(page.getByRole('heading', { level: 1, name: 'Acessos' })).toBeVisible()

  // Agrupado por projeto (padrão): um título por projeto, "Sem projeto" por último.
  const groups = page.getByRole('heading', { level: 2 })
  await expect(groups).toHaveText(['App Alfa', 'Site Beta', 'Sem projeto'])
  await expect(page.getByRole('region', { name: 'App Alfa' }).getByRole('listitem')).toHaveCount(2)

  // Em telas pequenas os filtros ficam atrás do botão "Filtros".
  if (isMobile) await page.getByRole('button', { name: /^Filtros/ }).click()

  // Filtro por projeto: só os acessos dele, a escolha vai para a URL e o "Novo acesso" já sai com o projeto.
  await page.getByLabel('Projeto', { exact: true }).selectOption(alfaId)
  await expect(page).toHaveURL(new RegExp(`projeto=${alfaId}`))
  await expect(page.getByRole('listitem')).toHaveCount(2)
  await expect(page.getByText('Vercel Alfa')).toBeVisible()
  await expect(page.getByText('Registro Beta')).toHaveCount(0)
  await expect(page.getByText('Mostrando os acessos de')).toBeVisible()
  await page.getByRole('link', { name: 'Novo acesso' }).click()
  const root = isMobile ? page : panel(page)
  await expect(root.getByLabel('Projeto', { exact: true })).toHaveValue(alfaId)
  await page.goBack()

  // Categoria (combinada com o projeto) e "Ver todos".
  if (isMobile) await page.getByRole('button', { name: /^Filtros/ }).click()
  await page.getByLabel('Categoria', { exact: true }).selectOption('Banco de dados')
  await expect(page.getByRole('listitem')).toHaveCount(1)
  await expect(page.getByText('Supabase Alfa')).toBeVisible()
  await page.getByRole('button', { name: 'Ver todos' }).click()
  await expect(page.getByText('Registro Beta')).toHaveCount(0) // a categoria continua valendo
  await page.getByLabel('Categoria', { exact: true }).selectOption('')

  // Sem projeto.
  await page.getByLabel('Projeto', { exact: true }).selectOption('sem')
  await expect(page.getByRole('listitem')).toHaveCount(1)
  await expect(page.getByText('E-mail do estúdio')).toBeVisible()
  await page.getByLabel('Projeto', { exact: true }).selectOption('')

  // Sem agrupar: lista única, com o projeto em cada linha; a preferência fica salva.
  await page.getByLabel('Agrupar por projeto').uncheck()
  await expect(page.getByRole('heading', { level: 2 })).toHaveCount(0)
  await expect(page.getByRole('listitem')).toHaveCount(4)
  await page.reload()
  await expect(page.getByLabel('Agrupar por projeto')).not.toBeChecked()
})

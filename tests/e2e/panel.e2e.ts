import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { apiSessionFor, createUser, login, panel } from './helpers'

// Desktop: registros abrem em painel lateral por cima da página de origem, com abas por assunto.
test('registro abre em painel sobre a origem, com abas, URL e teclado corretos', async ({ page }) => {
  const user = await createUser('panel')
  const { client, orgId } = await apiSessionFor(user)
  const t = await client
    .from('tasks')
    .insert({ organization_id: orgId, title: 'Tarefa do painel' })
    .select('id')
    .single()
  await client.from('task_plans').insert({
    organization_id: orgId,
    task_id: t.data!.id,
    planned_date: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date()),
  })
  await login(page, user)

  // Abre da Central do dia: o fundo continua sendo a Central do dia
  await page.getByRole('link', { name: 'Tarefa do painel' }).first().click()
  await expect(page).toHaveURL(new RegExp(`/app/tarefas/${t.data!.id}$`))
  const p = panel(page)
  await expect(p.getByRole('heading', { name: 'Tarefa do painel' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Central do dia', level: 1 })).toBeVisible()

  // Abas por assunto, com teclado; a aba ativa vai para a URL
  await expect(p.getByRole('tab', { name: 'Detalhes' })).toHaveAttribute('aria-selected', 'true')
  await p.getByRole('tab', { name: 'Detalhes' }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(p.getByRole('tab', { name: 'Tempo' })).toHaveAttribute('aria-selected', 'true')
  await expect(page).toHaveURL(/aba=tempo/)
  await expect(p.getByRole('heading', { name: 'Planejamento' })).toBeVisible()

  // Sem violações de acessibilidade com o painel aberto
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
  expect(axe.violations.map((v) => v.id)).toEqual([])

  // Expandir vira modal central e a escolha é lembrada ao reabrir
  await p.getByRole('button', { name: 'Expandir para modal grande' }).click()
  await expect(p).toHaveAttribute('data-expanded', 'true')
  await page.keyboard.press('Escape')
  await expect(page).toHaveURL(/\/app$/)
  await expect(p).toHaveCount(0)
  await page.getByRole('link', { name: 'Tarefa do painel' }).first().click()
  await expect(panel(page)).toHaveAttribute('data-expanded', 'true')

  // Voltar do navegador fecha o painel e devolve a origem
  await page.goBack()
  await expect(page).toHaveURL(/\/app$/)
  await expect(panel(page)).toHaveCount(0)

  // F5 numa URL de registro: o painel abre sobre a lista da entidade
  await page.goto(`/app/tarefas/${t.data!.id}`)
  await expect(panel(page).getByRole('heading', { name: 'Tarefa do painel' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Tarefas', level: 1 })).toBeVisible()
  await panel(page).getByRole('button', { name: 'Fechar' }).click()
  await expect(page).toHaveURL(/\/app\/tarefas$/)
})

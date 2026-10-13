import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { apiSessionFor, createUser, login } from './helpers'

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

async function openSearch(page: Page, isMobile: boolean) {
  if (isMobile) {
    await page.getByRole('button', { name: 'Mais' }).click()
    await page.getByRole('button', { name: 'Buscar' }).click()
  } else {
    await page.keyboard.press('Control+k')
  }
  const dialog = page.getByRole('dialog', { name: 'Buscar' })
  await expect(dialog).toBeVisible()
  return dialog
}

test('busca global: resultados por tipo, teclado, isolamento e caracteres especiais', async ({ page, isMobile }) => {
  test.setTimeout(90_000)
  const a = await createUser('search-a')
  const b = await createUser('search-b')

  const sa = await apiSessionFor(a)
  await sa.client.from('clients').insert({ organization_id: sa.orgId, name: 'Acme Estúdio', company_name: 'Acme Ltda' })
  await sa.client.from('projects').insert({ organization_id: sa.orgId, name: 'Site Acme' })
  await sa.client.from('tasks').insert({ organization_id: sa.orgId, title: 'Enviar proposta Acme' })
  const start = new Date(Date.now() + 3_600_000)
  await sa.client.from('calendar_events').insert({
    organization_id: sa.orgId,
    title: 'Alinhamento Acme',
    event_type: 'meeting',
    starts_at: start.toISOString(),
    ends_at: new Date(start.getTime() + 3_600_000).toISOString(),
    timezone: 'America/Sao_Paulo',
  })

  // Dado de OUTRA organização com o mesmo termo: nunca pode aparecer.
  const sb = await apiSessionFor(b)
  await sb.client.from('clients').insert({ organization_id: sb.orgId, name: 'Acme Segredo' })

  await login(page, a)
  const dialog = await openSearch(page, isMobile)
  const input = dialog.getByRole('combobox')

  // Menos de 2 letras: só a dica, sem consulta.
  await input.fill('a')
  await expect(dialog.getByText('Digite pelo menos 2 letras')).toBeVisible()
  await expect(dialog.getByRole('option')).toHaveCount(0)

  await input.fill('acme')
  await expect(dialog.getByRole('option')).toHaveCount(4)
  for (const group of ['Tarefas', 'Projetos', 'Clientes', 'Reuniões e eventos']) {
    await expect(dialog.getByRole('group', { name: group })).toBeVisible()
  }
  await expect(dialog).not.toContainText('Segredo')
  await expect(dialog.getByRole('option', { name: /Alinhamento Acme/ })).toContainText('Reunião')

  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze()
  expect(
    results.violations.map((v) => ({ rule: v.id, nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) })),
    'violações de acessibilidade na busca aberta',
  ).toEqual([])

  // Teclado: ↓ move a opção ativa (2ª = projeto) e Enter abre o registro.
  await input.press('ArrowDown')
  await expect(dialog.getByRole('option', { name: /Site Acme/ })).toHaveAttribute('aria-selected', 'true')
  await input.press('Enter')
  await expect(page).toHaveURL(/\/app\/projetos\/[0-9a-f-]{36}/)
  await expect(dialog).toBeHidden()

  // Caracteres especiais do LIKE/PostgREST não quebram nem viram curinga.
  const again = await openSearch(page, isMobile)
  await again.getByRole('combobox').fill('100%_(a),b')
  await expect(again.getByText(/Nenhum resultado para/)).toBeVisible()
  await expect(again.getByRole('option')).toHaveCount(0)

  // Esc fecha e devolve o foco ao app.
  await page.keyboard.press('Escape')
  await expect(again).toBeHidden()
})

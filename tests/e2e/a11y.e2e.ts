import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { apiSessionFor, createUser, login, type TestUser } from './helpers'

// WCAG 2.2 AA como referência (UI_UX_SPEC): varredura automatizada por tela, desktop e mobile.
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

async function scan(page: Page, label: string) {
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
  await page.waitForLoadState('networkidle')
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze()
  const summary = results.violations.map((v) => ({
    rule: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ')),
  }))
  expect(summary, `violações de acessibilidade em ${label}`).toEqual([])
}

test.describe('acessibilidade (axe)', () => {
  let user: TestUser
  let ids: { client: string; project: string; task: string; event: string }

  test.beforeAll(async () => {
    user = await createUser('a11y')
    const { client, orgId } = await apiSessionFor(user)
    const c = await client.from('clients').insert({ organization_id: orgId, name: 'Cliente A11y' }).select('id').single()
    const p = await client
      .from('projects')
      .insert({ organization_id: orgId, name: 'Projeto A11y', client_id: c.data!.id })
      .select('id')
      .single()
    const t = await client
      .from('tasks')
      .insert({ organization_id: orgId, title: 'Tarefa A11y', project_id: p.data!.id })
      .select('id')
      .single()
    const start = new Date(Date.now() + 3_600_000)
    const e = await client
      .from('calendar_events')
      .insert({
        organization_id: orgId,
        title: 'Evento A11y',
        starts_at: start.toISOString(),
        ends_at: new Date(start.getTime() + 3_600_000).toISOString(),
        timezone: 'America/Sao_Paulo',
      })
      .select('id')
      .single()
    ids = { client: c.data!.id, project: p.data!.id, task: t.data!.id, event: e.data!.id }
  })

  test('login', async ({ page }) => {
    await page.goto('/login')
    await scan(page, '/login')
  })

  test('telas principais e de detalhe', async ({ page }) => {
    test.setTimeout(180_000)
    await login(page, user)
    const routes = [
      '/app',
      '/app/meu-dia',
      '/app/agenda',
      '/app/agenda/novo',
      `/app/agenda/${ids.event}`,
      '/app/tarefas',
      '/app/tarefas/modelos',
      `/app/tarefas/${ids.task}`,
      '/app/reunioes',
      '/app/projetos',
      '/app/projetos/novo',
      `/app/projetos/${ids.project}`,
      '/app/clientes',
      '/app/clientes/novo',
      `/app/clientes/${ids.client}`,
      '/app/notificacoes',
      '/app/configuracoes',
    ]
    for (const path of routes) {
      await page.goto(path)
      await scan(page, path)
    }
  })
})

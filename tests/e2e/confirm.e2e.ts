import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { apiSessionFor, createUser, login } from './helpers'

test('ações pouco reversíveis pedem confirmação, com foco e teclado corretos', async ({ page }) => {
  const user = await createUser('conf')
  const { client, orgId } = await apiSessionFor(user)
  const c = await client.from('clients').insert({ organization_id: orgId, name: 'Cliente Conf' }).select('id').single()
  const p = await client
    .from('projects')
    .insert({ organization_id: orgId, name: 'Projeto Conf', client_id: c.data!.id })
    .select('id')
    .single()
  const start = new Date(Date.now() + 3_600_000)
  const e = await client
    .from('calendar_events')
    .insert({
      organization_id: orgId,
      title: 'Evento Conf',
      starts_at: start.toISOString(),
      ends_at: new Date(start.getTime() + 3_600_000).toISOString(),
      timezone: 'America/Sao_Paulo',
    })
    .select('id')
    .single()
  await client.from('checklist_templates').insert({ organization_id: orgId, name: 'Modelo Conf' })

  await login(page, user)

  // --- Projeto: Esc cancela, foco volta ao botão, axe com o diálogo aberto, confirmar arquiva
  await page.goto(`/app/projetos/${p.data!.id}`)
  const archive = page.getByRole('button', { name: 'Arquivar' })
  await archive.click()
  const dialog = page.getByRole('alertdialog', { name: /Arquivar “Projeto Conf”\?/ })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Voltar' })).toBeFocused()

  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
  expect(axe.violations.map((v) => v.id)).toEqual([])

  // Foco preso: Tab percorre só os botões do diálogo
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Tab')
    expect(await page.evaluate(() => document.activeElement?.closest('dialog') !== null)).toBe(true)
  }

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(archive).toBeFocused()
  await expect(page.getByText(/Arquivado em/)).toHaveCount(0)

  await archive.click()
  await page.getByRole('button', { name: 'Arquivar projeto' }).click()
  await expect(page.getByText('Projeto arquivado.')).toBeVisible()
  await expect(page.getByText(/Arquivado em/)).toBeVisible()

  // Restaurar não pede confirmação
  await page.getByRole('button', { name: 'Restaurar' }).click()
  await expect(page.getByText('Projeto restaurado.')).toBeVisible()

  // --- Cliente
  await page.goto(`/app/clientes/${c.data!.id}`)
  await page.getByRole('button', { name: 'Arquivar' }).click()
  await expect(page.getByRole('alertdialog', { name: /Arquivar “Cliente Conf”\?/ })).toBeVisible()
  await page.getByRole('button', { name: 'Voltar' }).click()
  await expect(page.getByRole('alertdialog')).toBeHidden()
  await page.getByRole('button', { name: 'Arquivar' }).click()
  await page.getByRole('button', { name: 'Arquivar cliente' }).click()
  await expect(page.getByText('Cliente arquivado.')).toBeVisible()

  // --- Evento: "Manter" não cancela; confirmar cancela
  await page.goto(`/app/agenda/${e.data!.id}`)
  await page.getByRole('button', { name: 'Cancelar evento' }).click()
  await page.getByRole('button', { name: 'Manter evento' }).click()
  await expect(page.locator('header').getByText('Agendado', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Cancelar evento' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancelar evento' }).click()
  await expect(page.getByText('Evento cancelado.')).toBeVisible()
  await expect(page.locator('header').getByText('Cancelado', { exact: true })).toBeVisible()

  // --- Modelo de checklist: excluir só depois de confirmar
  await page.goto('/app/tarefas/modelos')
  await expect(page.getByText('Modelo Conf')).toBeVisible()
  await page.getByRole('button', { name: 'Excluir' }).click()
  await expect(page.getByRole('alertdialog', { name: /Excluir o modelo “Modelo Conf”\?/ })).toBeVisible()
  await page.getByRole('button', { name: 'Voltar' }).click()
  await expect(page.getByText('Modelo Conf')).toBeVisible()
  await page.getByRole('button', { name: 'Excluir' }).click()
  await page.getByRole('button', { name: 'Excluir modelo' }).click()
  await expect(page.getByText('Modelo Conf')).toHaveCount(0)
})

import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { createUser, login, panel } from './helpers'

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

test('seletor de data e hora: digitar, calendário, horários, teclado, Esc e salvar', async ({ page, isMobile }) => {
  test.setTimeout(120_000)
  const user = await createUser('picker')
  await login(page, user)
  await page.goto('/app/agenda/novo')
  const root = isMobile ? page : panel(page)

  await root.getByLabel('Título *').fill('Evento do seletor')

  // Calendário + horário pelo mouse.
  const start = root.getByLabel('Início *')
  await root.getByRole('button', { name: 'Abrir calendário' }).first().click()
  const popover = page.getByRole('dialog', { name: 'Escolher data e hora' })
  await expect(popover).toBeVisible()
  await expect(popover.getByRole('grid')).toBeVisible()

  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze()
  expect(
    results.violations.map((v) => ({ rule: v.id, nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) })),
    'violações de acessibilidade com o seletor aberto',
  ).toEqual([])

  await popover.getByRole('button', { name: /^20 de .* de \d{4}$/ }).first().click()
  await popover.getByRole('option', { name: '14:30' }).click()
  await expect(popover).toBeHidden()
  await expect(start).toHaveValue(/^20\/\d{2}\/\d{4} 14:30$/)

  // Esc fecha só o seletor; o painel/página continua aberto.
  await root.getByRole('button', { name: 'Abrir calendário' }).first().click()
  await expect(popover).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(popover).toBeHidden()
  await expect(root.getByLabel('Título *')).toBeVisible()

  // Digitação com máscara e teclado no calendário.
  await start.fill('')
  await start.pressSequentially('251220300915')
  await expect(start).toHaveValue('25/12/2030 09:15')
  await start.blur()
  await root.getByRole('button', { name: 'Abrir calendário' }).first().click()
  await expect(popover.getByRole('button', { name: '25 de dezembro de 2030' })).toHaveAttribute('aria-pressed', 'true')
  await popover.getByRole('button', { name: '25 de dezembro de 2030' }).focus()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Enter')
  await expect(start).toHaveValue('26/12/2030 09:15')
  await page.keyboard.press('Escape')

  // Data que não existe: avisa e não deixa passar.
  await start.fill('31/02/2030 10:00')
  await start.blur()
  await expect(root.getByText('Data e hora inválidas. Use dd/mm/aaaa hh:mm.')).toBeVisible()

  // Fim = 1 h depois; salva e confere a ida e volta.
  await start.fill('26/12/2030 09:15')
  await root.getByLabel('Fim *').fill('26/12/2030 10:15')
  await root.getByRole('button', { name: 'Criar', exact: true }).click()
  await expect(root.getByRole('heading', { name: 'Evento do seletor' })).toBeVisible()
  await expect(root.getByLabel('Início *')).toHaveValue('26/12/2030 09:15')
  await expect(root.getByLabel('Fim *')).toHaveValue('26/12/2030 10:15')
})

import { expect, test } from '@playwright/test'
import { apiSessionFor, createUser, login } from './helpers'

test('configurações de envio: validar, salvar, pausar tudo e retomar', async ({ page }) => {
  test.setTimeout(90_000)
  const user = await createUser('outreach-settings')
  const { client, orgId } = await apiSessionFor(user)
  await login(page, user)
  await page.goto('/app/prospeccao/configuracoes')
  await expect(page.getByRole('heading', { level: 1, name: 'Configurações' })).toBeVisible()
  await expect(page.getByText('Ativos', { exact: true })).toBeVisible()

  // Validação: janela invertida e limite fora da faixa.
  await page.getByLabel('Janela: início').fill('18:00')
  await page.getByLabel('Janela: fim').fill('09:00')
  await page.getByLabel('E-mails por dia').fill('500')
  await page.getByRole('button', { name: 'Salvar', exact: true }).click()
  await expect(page.getByText('O fim da janela vem depois do início')).toBeVisible()
  await expect(page.getByText('Informe um número de 1 a 100').first()).toBeVisible()

  // Salvar de verdade.
  await page.getByLabel('E-mail de envio').fill('Estúdio <contato@estudio.com.br>')
  await page.getByLabel('Janela: início').fill('08:30')
  await page.getByLabel('Janela: fim').fill('17:00')
  await page.getByLabel('E-mails por dia').fill('30')
  await page.getByLabel('Conversas novas no WhatsApp por dia').fill('10')
  await page.getByRole('button', { name: 'Salvar', exact: true }).click()
  await expect(page.getByText('Configurações salvas.')).toBeVisible()
  const row = await client.from('outreach_settings').select('*').eq('organization_id', orgId).single()
  expect(row.data).toMatchObject({ email_from: 'Estúdio <contato@estudio.com.br>', email_daily_limit: 30, whatsapp_daily_limit: 10, paused: false })
  expect(row.data!.window_start.slice(0, 5)).toBe('08:30')

  // Pausar tudo e retomar.
  await page.getByRole('button', { name: 'Pausar tudo' }).click()
  await expect(page.getByText('Todos os envios pausados.')).toBeVisible()
  await expect(page.getByText('Pausados', { exact: true })).toBeVisible()
  expect((await client.from('outreach_settings').select('paused').single()).data!.paused).toBe(true)
  await page.getByRole('button', { name: 'Retomar envios' }).click()
  await expect(page.getByText('Envios retomados.')).toBeVisible()
  expect((await client.from('outreach_settings').select('paused').single()).data!.paused).toBe(false)

  // Rascunho com IA: desligada por padrão; ligar e limitar o uso.
  const ai = page.getByRole('region', { name: 'Rascunho com IA' })
  await expect(ai.getByText('Desligada', { exact: true })).toBeVisible()
  expect((await client.from('outreach_settings').select('draft_provider, ai_daily_limit').single()).data).toMatchObject({ draft_provider: 'none', ai_daily_limit: 20 })
  await ai.getByLabel('Rascunhos de IA por dia').fill('500')
  await expect(ai.getByText('Informe um número de 1 a 200')).toBeVisible()
  await expect(ai.getByRole('button', { name: 'Salvar IA' })).toBeDisabled()
  await ai.getByLabel('Rascunhos de IA por dia').fill('15')
  await ai.getByLabel('Ligar o rascunho com IA').check()
  await ai.getByRole('button', { name: 'Salvar IA' }).click()
  await expect(page.getByText('Configuração da IA salva.')).toBeVisible()
  await expect(ai.getByText('Ligada', { exact: true })).toBeVisible()
  expect((await client.from('outreach_settings').select('draft_provider, ai_daily_limit').single()).data).toMatchObject({ draft_provider: 'deepseek', ai_daily_limit: 15 })
})

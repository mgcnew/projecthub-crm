import { expect, test } from '@playwright/test'
import { apiSessionFor, createUser, login, panel } from './helpers'

const MASTER = 'Minha Frase Mestra Longa 2026'
const SECRET = 'S3nh@-Super-Secreta-9'

test('cofre: criar, guardar a senha cifrada, travar, errar a senha mestra e trocar a senha mestra', async ({ page, isMobile }) => {
  test.setTimeout(180_000)
  const user = await createUser('vault')
  const { client, orgId } = await apiSessionFor(user)
  const access = await client.from('access_entries').insert({ organization_id: orgId, name: 'Painel do banco' }).select('id').single()
  const accessId = access.data!.id as string
  await login(page, user)

  // Validação da senha mestra e do aviso de consentimento.
  await page.goto('/app/configuracoes?aba=cofre')
  const tab = page.getByRole('tabpanel', { name: 'Cofre' })
  await tab.getByLabel('Senha mestra', { exact: true }).fill('curta')
  await tab.getByLabel('Repita a senha mestra').fill('outra')
  await tab.getByRole('button', { name: 'Criar cofre' }).click()
  await expect(tab.getByText(/14 caracteres ou mais/)).toBeVisible()
  await expect(tab.getByText('As senhas não conferem')).toBeVisible()
  await expect(tab.getByText(/Confirme que você entendeu/)).toBeVisible()

  // Criação do cofre (aceita o termo de que não há recuperação).
  await tab.getByLabel('Senha mestra', { exact: true }).fill(MASTER)
  await tab.getByLabel('Repita a senha mestra').fill(MASTER)
  await tab.getByLabel(/Entendi que/).check()
  await tab.getByRole('button', { name: 'Criar cofre' }).click()
  await expect(tab.getByText('Destrancado', { exact: true })).toBeVisible({ timeout: 20_000 })

  // Guardar a senha de um acesso.
  await page.goto(`/app/acessos/${accessId}?aba=senha`)
  const root = isMobile ? page : panel(page)
  const secretTab = root.getByRole('tabpanel', { name: 'Senha' })
  // Recarregar a página trancou o cofre (a chave só vive na memória): pede a senha mestra.
  await secretTab.getByRole('button', { name: 'Destrancar o cofre' }).click()
  const dialog = page.getByRole('dialog', { name: 'Destrancar o cofre' })
  await dialog.getByLabel('Senha mestra').fill('senha errada qualquer 1A')
  await dialog.getByRole('button', { name: 'Destrancar' }).click()
  await expect(dialog.getByText(/Restam 4 de 5 tentativas/)).toBeVisible({ timeout: 20_000 })
  await dialog.getByLabel('Senha mestra').fill(MASTER)
  await dialog.getByRole('button', { name: 'Destrancar' }).click()
  await expect(dialog).toBeHidden({ timeout: 20_000 })

  await secretTab.getByLabel('Senha', { exact: true }).fill(SECRET)
  await secretTab.getByLabel(/Notas/).fill('pergunta: primeiro pet')
  await secretTab.getByRole('button', { name: 'Guardar no cofre' }).click()
  await expect(secretTab.getByText('Senha guardada no cofre.')).toBeVisible()
  const value = secretTab.getByTestId('secret-value')
  await expect(value).toHaveText('••••••••••••')
  await secretTab.getByRole('button', { name: 'Mostrar' }).click()
  await expect(value).toHaveText(SECRET)
  await expect(secretTab.getByText('pergunta: primeiro pet')).toBeVisible()

  // O servidor só tem texto cifrado: nem a senha nem as notas aparecem no banco.
  const row = await client.from('vault_items').select('iv, ciphertext').eq('access_id', accessId).single()
  const stored = Buffer.from(String(row.data!.ciphertext).slice(2), 'hex').toString('latin1')
  expect(stored).not.toContain('Super-Secreta')
  expect(stored).not.toContain('primeiro pet')
  const forbidden = await client.from('vault_meta').select('verifier')
  expect(forbidden.error).not.toBeNull() // o verificador nunca é legível

  // A lista marca quem tem senha no cofre.
  await page.goto('/app/acessos')
  await expect(page.getByRole('listitem').filter({ hasText: 'Painel do banco' }).getByText('Senha no cofre')).toBeVisible()

  // Trancar (manual) e destrancar de novo; depois trocar a senha mestra.
  await page.goto('/app/configuracoes?aba=cofre')
  await tab.getByRole('button', { name: 'Destrancar' }).click()
  const unlockDialog = page.getByRole('dialog', { name: 'Destrancar o cofre' })
  await unlockDialog.getByLabel('Senha mestra').fill(MASTER)
  await unlockDialog.getByRole('button', { name: 'Destrancar' }).click()
  await expect(tab.getByText('Destrancado', { exact: true })).toBeVisible({ timeout: 20_000 })
  await tab.getByRole('button', { name: 'Trancar agora' }).click()
  await expect(tab.getByText('Trancado', { exact: true })).toBeVisible()
  await tab.getByRole('button', { name: 'Trocar a senha mestra' }).click()
  const rekey = page.getByRole('heading', { name: 'Trocar a senha mestra', level: 2 })
  await expect(rekey).toBeVisible()
  const NEW_MASTER = 'Outra Frase Mestra Longa 2027'
  await page.getByLabel('Senha mestra atual', { exact: true }).fill(MASTER)
  await page.getByLabel('Nova senha mestra', { exact: true }).fill(NEW_MASTER)
  await page.getByLabel('Repita a nova senha mestra').fill(NEW_MASTER)
  await page.getByRole('button', { name: 'Trocar senha mestra' }).click()
  await expect(tab.getByText('Senha mestra trocada.')).toBeVisible({ timeout: 30_000 })

  await tab.getByRole('button', { name: 'Destrancar' }).click()
  const dlg = page.getByRole('dialog', { name: 'Destrancar o cofre' })
  await dlg.getByLabel('Senha mestra').fill(MASTER) // a antiga não vale mais
  await dlg.getByRole('button', { name: 'Destrancar' }).click()
  await expect(dlg.getByText(/Senha mestra incorreta/)).toBeVisible({ timeout: 20_000 })
  await dlg.getByLabel('Senha mestra').fill(NEW_MASTER)
  await dlg.getByRole('button', { name: 'Destrancar' }).click()
  await expect(tab.getByText('Destrancado', { exact: true })).toBeVisible({ timeout: 20_000 })

  // A senha guardada continua legível com a senha mestra nova (a DEK não mudou).
  await page.goto(`/app/acessos/${accessId}?aba=senha`)
  await expect(secretTab.getByRole('button', { name: 'Destrancar o cofre' })).toBeVisible()
  await secretTab.getByRole('button', { name: 'Destrancar o cofre' }).click()
  await page.getByRole('dialog', { name: 'Destrancar o cofre' }).getByLabel('Senha mestra').fill(NEW_MASTER)
  await page.getByRole('dialog', { name: 'Destrancar o cofre' }).getByRole('button', { name: 'Destrancar' }).click()
  await secretTab.getByRole('button', { name: 'Mostrar' }).click()
  await expect(secretTab.getByTestId('secret-value')).toHaveText(SECRET, { timeout: 20_000 })
})

test('cofre: erros seguidos bloqueiam e depois destroem o cofre e o que há dentro', async ({ page }) => {
  test.setTimeout(180_000)
  const user = await createUser('vault-destroy')
  const { client, orgId } = await apiSessionFor(user)
  const access = await client.from('access_entries').insert({ organization_id: orgId, name: 'Hospedagem' }).select('id').single()
  await login(page, user)
  await page.goto('/app/configuracoes?aba=cofre')
  const tab = page.getByRole('tabpanel', { name: 'Cofre' })
  await tab.getByLabel('Senha mestra', { exact: true }).fill(MASTER)
  await tab.getByLabel('Repita a senha mestra').fill(MASTER)
  await tab.getByLabel('Erros seguidos que destroem o cofre').selectOption('3')
  await tab.getByLabel(/Entendi que/).check()
  await tab.getByRole('button', { name: 'Criar cofre' }).click()
  await expect(tab.getByText('Destrancado', { exact: true })).toBeVisible({ timeout: 20_000 })
  await page.reload()

  await page.getByRole('tabpanel', { name: 'Cofre' }).getByRole('button', { name: 'Destrancar' }).click()
  const dialog = page.getByRole('dialog', { name: 'Destrancar o cofre' })
  for (const left of [/Restam 2 de 3/, /ÚLTIMA tentativa/]) {
    await dialog.getByLabel('Senha mestra').fill('errada errada errada 1A')
    await dialog.getByRole('button', { name: 'Destrancar' }).click()
    await expect(dialog.getByText(left)).toBeVisible({ timeout: 20_000 })
  }
  await dialog.getByLabel('Senha mestra').fill('errada errada errada 1A')
  await dialog.getByRole('button', { name: 'Destrancar' }).click()
  await expect(dialog.getByText(/o cofre foi destruído/)).toBeVisible({ timeout: 20_000 })

  // Sumiu do banco: nada de metadados nem de itens.
  const meta = await client.from('vault_meta').select('organization_id')
  expect(meta.data).toEqual([])
  expect(access.data!.id).toBeTruthy()
  await dialog.getByRole('button', { name: 'Fechar' }).click()
  await page.reload()
  await expect(page.getByRole('tabpanel', { name: 'Cofre' }).getByRole('button', { name: 'Criar cofre' })).toBeVisible()
})

test('cofre: exportar o backup cifrado, destruir o cofre e restaurar do arquivo', async ({ page }) => {
  test.setTimeout(240_000)
  const user = await createUser('vault-backup')
  const { client, orgId } = await apiSessionFor(user)
  const access = await client.from('access_entries').insert({ organization_id: orgId, name: 'Registro de domínio' }).select('id').single()
  const accessId = access.data!.id as string
  await login(page, user)

  await page.goto('/app/configuracoes?aba=cofre')
  const tab = page.getByRole('tabpanel', { name: 'Cofre' })
  await tab.getByLabel('Senha mestra', { exact: true }).fill(MASTER)
  await tab.getByLabel('Repita a senha mestra').fill(MASTER)
  await tab.getByLabel(/Entendi que/).check()
  await tab.getByRole('button', { name: 'Criar cofre' }).click()
  await expect(tab.getByText('Destrancado', { exact: true })).toBeVisible({ timeout: 20_000 })

  // Guardar uma senha (a página recarregou ao navegar: destranca antes).
  await page.goto(`/app/acessos/${accessId}?aba=senha`)
  const secretTab = page.getByRole('tabpanel', { name: 'Senha' }).first()
  await secretTab.getByRole('button', { name: 'Destrancar o cofre' }).click()
  const dialog = page.getByRole('dialog', { name: 'Destrancar o cofre' })
  await dialog.getByLabel('Senha mestra').fill(MASTER)
  await dialog.getByRole('button', { name: 'Destrancar' }).click()
  await expect(dialog).toBeHidden({ timeout: 20_000 })
  await secretTab.getByLabel('Senha', { exact: true }).fill(SECRET)
  await secretTab.getByRole('button', { name: 'Guardar no cofre' }).click()
  await expect(secretTab.getByText('Senha guardada no cofre.')).toBeVisible()

  // Exportar: o arquivo baixa e não contém a senha em texto.
  await page.goto('/app/configuracoes?aba=cofre')
  await tab.getByLabel('Senha mestra', { exact: true }).fill('errada errada errada 1A')
  await tab.getByRole('button', { name: 'Exportar backup' }).click()
  await expect(tab.getByText(/Senha mestra incorreta. Restam 4/)).toBeVisible({ timeout: 20_000 })
  await tab.getByLabel('Senha mestra', { exact: true }).fill(MASTER)
  const [download] = await Promise.all([page.waitForEvent('download'), tab.getByRole('button', { name: 'Exportar backup' }).click()])
  expect(download.suggestedFilename()).toMatch(/^cofre-voltier-\d{4}-\d{2}-\d{2}\.json$/)
  const path = await download.path()
  const content = (await import('node:fs')).readFileSync(path, 'utf8')
  expect(content).toContain('voltier-cofre-backup')
  expect(content).not.toContain('Super-Secreta')
  await expect(tab.getByText(/Backup criado com 1 senha/)).toBeVisible({ timeout: 20_000 })

  // Destruir o cofre (a pedido) e restaurar do arquivo.
  await tab.getByRole('button', { name: 'Destruir o cofre' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Destruir o cofre' }).click()
  await expect(tab.getByText('Cofre destruído.')).toBeVisible()
  await page.reload()
  await expect(tab.getByRole('button', { name: 'Criar cofre' })).toBeVisible()
  await tab.getByLabel('Arquivo de backup (.json)').setInputFiles(path)
  await tab.getByLabel('Senha mestra do backup').fill('senha errada do backup 1A')
  await tab.getByRole('button', { name: 'Restaurar cofre' }).click()
  await expect(tab.getByText('Senha mestra do backup incorreta.')).toBeVisible({ timeout: 20_000 })
  await tab.getByLabel('Senha mestra do backup').fill(MASTER)
  await tab.getByRole('button', { name: 'Restaurar cofre' }).click()
  await expect(tab.getByText(/Cofre restaurado com 1 senha/)).toBeVisible({ timeout: 30_000 })

  // A senha voltou e é legível.
  await page.goto(`/app/acessos/${accessId}?aba=senha`)
  await secretTab.getByRole('button', { name: 'Destrancar o cofre' }).click()
  await dialog.getByLabel('Senha mestra').fill(MASTER)
  await dialog.getByRole('button', { name: 'Destrancar' }).click()
  await secretTab.getByRole('button', { name: 'Mostrar' }).click()
  await expect(secretTab.getByTestId('secret-value')).toHaveText(SECRET, { timeout: 20_000 })
})

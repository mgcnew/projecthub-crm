import { expect, test } from '@playwright/test'
import { apiSessionFor, createUser, login } from './helpers'

test('um usuário não vê nem abre os dados do outro', async ({ browser }) => {
  const a = await createUser('iso-a')
  const b = await createUser('iso-b')

  const { client, orgId } = await apiSessionFor(a)
  const created = await client
    .from('clients')
    .insert({ organization_id: orgId, name: 'Cliente Secreto de A' })
    .select('id')
    .single()
  expect(created.error).toBeNull()
  const secretId = created.data!.id

  const ctxA = await browser.newContext()
  const pageA = await ctxA.newPage()
  await login(pageA, a)
  await pageA.goto('/app/clientes')
  await expect(pageA.getByText('Cliente Secreto de A')).toBeVisible()

  const ctxB = await browser.newContext()
  const pageB = await ctxB.newPage()
  await login(pageB, b)
  await pageB.goto('/app/clientes')
  await expect(pageB.getByText('Nenhum cliente encontrado')).toBeVisible()
  await expect(pageB.getByText('Cliente Secreto de A')).toHaveCount(0)

  // Acesso direto pela URL: a RLS devolve vazio e a tela trata como inexistente.
  await pageB.goto(`/app/clientes/${secretId}`)
  await expect(pageB.getByText('Cliente não encontrado.')).toBeVisible()

  await ctxA.close()
  await ctxB.close()
})

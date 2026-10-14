import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { expect, type Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { totp } from '../support/totp'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_PUBLISHABLE_KEY

export type TestUser = { email: string; password: string }

function api(): SupabaseClient {
  if (!url || !key) throw new Error('Defina SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY (use npm run test:e2e).')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

/** Cria um usuário novo pela API de Auth; o trigger provisiona perfil, organização e vínculo owner. */
export async function createUser(label = 'e2e'): Promise<TestUser> {
  const user = { email: `${label}-${randomUUID()}@test.local`, password: `Pw-${randomUUID()}` }
  const { error } = await api().auth.signUp(user)
  if (error) throw error
  return user
}

/** Cliente autenticado para preparar dados sem passar pela UI. */
export async function apiSessionFor(user: TestUser) {
  const client = api()
  const { error } = await client.auth.signInWithPassword(user)
  if (error) throw error
  const org = await client.from('organizations').select('id').single()
  if (org.error) throw org.error
  return { client, orgId: org.data.id as string }
}

export async function login(page: Page, user: TestUser) {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(user.email)
  await page.getByLabel('Senha', { exact: true }).fill(user.password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('heading', { name: 'Central do dia' })).toBeVisible()
}

/** Valor de <input type="datetime-local"> para `date` no fuso `tz`. */
export function localInput(date: Date, tz = 'America/Sao_Paulo') {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
      .formatToParts(date)
      .map((x) => [x.type, x.value]),
  )
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`
}

/**
 * Registro aberto no desktop: o painel (diálogo) por cima da página de origem. O fundo fica inerte mas
 * continua no DOM com os mesmos rótulos; por isso os specs de desktop miram sempre dentro do diálogo.
 */
export const panel = (page: Page) => page.getByRole('dialog').first()

/** Ativa o TOTP do usuário direto pela API (sem a tela) e devolve o segredo para gerar códigos. */
export async function enableMfa(user: TestUser): Promise<string> {
  const client = api()
  const login = await client.auth.signInWithPassword(user)
  if (login.error) throw login.error
  const enroll = await client.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'e2e' })
  if (enroll.error) throw enroll.error
  const ch = await client.auth.mfa.challenge({ factorId: enroll.data.id })
  if (ch.error) throw ch.error
  const ok = await client.auth.mfa.verify({ factorId: enroll.data.id, challengeId: ch.data.id, code: totp(enroll.data.totp.secret) })
  if (ok.error) throw ok.error
  return enroll.data.totp.secret
}

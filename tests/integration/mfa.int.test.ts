import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { linkIn, waitForMail } from '../support/mail'
import { totp } from '../support/totp'

const url = process.env.SUPABASE_URL!
const key = process.env.SUPABASE_PUBLISHABLE_KEY!
const PASSWORD = `Pw-${randomUUID()}`

function newClient() {
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function signUp(label: string) {
  const client = newClient()
  const email = `${label}-${randomUUID()}@test.local`
  const { error } = await client.auth.signUp({ email, password: PASSWORD })
  expect(error).toBeNull()
  return { client, email }
}

async function aal(client: SupabaseClient) {
  const { data } = await client.auth.mfa.getAuthenticatorAssuranceLevel()
  return data
}

describe('MFA (TOTP) imposta no banco, com Auth real', () => {
  let user: Awaited<ReturnType<typeof signUp>>
  let factorId: string
  let secret: string
  let newPassword: string

  beforeAll(async () => {
    user = await signUp('mfa')
    await user.client.from('clients').insert({
      organization_id: (await user.client.from('organizations').select('id').single()).data!.id,
      name: 'Cliente antes do MFA',
    })
  })

  it('sem fator, a sessão aal1 lê e grava', async () => {
    const r = await user.client.from('clients').select('name')
    expect(r.data).toEqual([{ name: 'Cliente antes do MFA' }])
    expect((await aal(user.client))?.nextLevel).toBe('aal1')
  })

  it('inscrição ainda não verificada não bloqueia nada', async () => {
    const enroll = await user.client.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'App' })
    expect(enroll.error).toBeNull()
    factorId = enroll.data!.id
    secret = enroll.data!.totp.secret
    expect(enroll.data!.totp.qr_code).toMatch(/^data:image\/svg\+xml/)
    const r = await user.client.from('clients').select('name')
    expect(r.error).toBeNull()
    expect(r.data).toHaveLength(1)
  })

  it('código errado não verifica o fator', async () => {
    const ch = await user.client.auth.mfa.challenge({ factorId })
    const bad = await user.client.auth.mfa.verify({ factorId, challengeId: ch.data!.id, code: '000000' })
    expect(bad.error).not.toBeNull()
  })

  it('código correto sobe a sessão para aal2', async () => {
    const ch = await user.client.auth.mfa.challenge({ factorId })
    const ok = await user.client.auth.mfa.verify({ factorId, challengeId: ch.data!.id, code: totp(secret) })
    expect(ok.error).toBeNull()
    expect((await aal(user.client))?.currentLevel).toBe('aal2')
    const r = await user.client.from('clients').select('name')
    expect(r.data).toHaveLength(1)
  })

  it('nova sessão só com senha (aal1) não lê nem grava nada', async () => {
    const c = newClient()
    const login = await c.auth.signInWithPassword({ email: user.email, password: PASSWORD })
    expect(login.error).toBeNull()
    const a = await aal(c)
    expect(a?.currentLevel).toBe('aal1')
    expect(a?.nextLevel).toBe('aal2')

    expect((await c.from('clients').select('name')).data).toEqual([])
    expect((await c.from('organizations').select('id')).data).toEqual([])
    const orgId = (await user.client.from('organizations').select('id').single()).data!.id
    const ins = await c.from('clients').insert({ organization_id: orgId, name: 'Invasor' })
    expect(ins.error).not.toBeNull()

    // aal1 também não consegue remover o fator.
    const un = await c.auth.mfa.unenroll({ factorId })
    expect(un.error).not.toBeNull()
  })

  it('a mesma senha + código de 6 dígitos libera o acesso (aal2)', async () => {
    const c = newClient()
    await c.auth.signInWithPassword({ email: user.email, password: PASSWORD })
    const ch = await c.auth.mfa.challenge({ factorId })
    const ok = await c.auth.mfa.verify({ factorId, challengeId: ch.data!.id, code: totp(secret) })
    expect(ok.error).toBeNull()
    expect((await c.from('clients').select('name')).data).toHaveLength(1)
  })

  it('recuperação de senha por e-mail não contorna o MFA: exige o código antes de trocar a senha', async () => {
    const c = newClient()
    const redirectTo = 'http://127.0.0.1:5173/redefinir-senha'
    const reset = await c.auth.resetPasswordForEmail(user.email, { redirectTo })
    expect(reset.error).toBeNull()

    const mail = await waitForMail(user.email)
    const res = await fetch(linkIn(mail, '/auth/v1/verify'), { redirect: 'manual' })
    const location = res.headers.get('location') ?? ''
    expect(location.startsWith(redirectTo)).toBe(true)
    const params = new URLSearchParams(location.split('#')[1])
    const recovery = newClient()
    const set = await recovery.auth.setSession({
      access_token: params.get('access_token')!,
      refresh_token: params.get('refresh_token')!,
    })
    expect(set.error).toBeNull()

    // Sessão de recuperação é aal1: não vê dados e não pode trocar a senha.
    expect((await aal(recovery))?.currentLevel).toBe('aal1')
    expect((await recovery.from('clients').select('name')).data).toEqual([])
    const blocked = await recovery.auth.updateUser({ password: `Nova-${randomUUID()}` })
    expect(blocked.error?.message).toMatch(/AAL2/)

    // Com o código, a mesma sessão sobe para aal2 e a troca é permitida.
    const ch = await recovery.auth.mfa.challenge({ factorId })
    const ok = await recovery.auth.mfa.verify({ factorId, challengeId: ch.data!.id, code: totp(secret) })
    expect(ok.error).toBeNull()
    newPassword = `Nova-${randomUUID()}`
    const upd = await recovery.auth.updateUser({ password: newPassword })
    expect(upd.error).toBeNull()
  })

  it('senha antiga deixa de valer; a nova continua exigindo o código', async () => {
    const old = newClient()
    const bad = await old.auth.signInWithPassword({ email: user.email, password: PASSWORD })
    expect(bad.error).not.toBeNull()

    const c = newClient()
    const ok = await c.auth.signInWithPassword({ email: user.email, password: newPassword })
    expect(ok.error).toBeNull()
    expect((await aal(c))?.currentLevel).toBe('aal1')
    expect((await c.from('clients').select('name')).data).toEqual([])
  })

  it('remover o fator em aal2 devolve o acesso só com a senha', async () => {
    const strong = newClient()
    await strong.auth.signInWithPassword({ email: user.email, password: newPassword })
    const ch = await strong.auth.mfa.challenge({ factorId })
    const verified = await strong.auth.mfa.verify({ factorId, challengeId: ch.data!.id, code: totp(secret) })
    expect(verified.error).toBeNull()
    const un = await strong.auth.mfa.unenroll({ factorId })
    expect(un.error).toBeNull()

    const c = newClient()
    const login = await c.auth.signInWithPassword({ email: user.email, password: newPassword })
    expect(login.error).toBeNull()
    expect((await c.from('clients').select('name')).data).toHaveLength(1)
  })
})

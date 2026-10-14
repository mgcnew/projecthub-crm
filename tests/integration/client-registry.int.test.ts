import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

const url = process.env.SUPABASE_URL!
const key = process.env.SUPABASE_PUBLISHABLE_KEY!
const PASSWORD = `Pw-${randomUUID()}`
const newClient = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

async function signUp(label: string) {
  const client = newClient()
  const { error } = await client.auth.signUp({ email: `${label}-${randomUUID()}@test.local`, password: PASSWORD })
  expect(error).toBeNull()
  const org = await client.from('organizations').select('id').single()
  return { client, orgId: org.data!.id as string }
}

describe('cadastro do cliente e contatos com sessões reais', () => {
  let a: Awaited<ReturnType<typeof signUp>>
  let b: Awaited<ReturnType<typeof signUp>>
  let clientId: string

  beforeAll(async () => {
    a = await signUp('reg-a')
    b = await signUp('reg-b')
    const c = await a.client.from('clients').insert({ organization_id: a.orgId, name: 'Cliente Reg' }).select('id').single()
    clientId = c.data!.id
  })

  it('completa o cadastro e o lê de volta', async () => {
    const upd = await a.client
      .from('clients')
      .update({
        legal_name: 'Acme Ltda',
        tax_id: '11.222.333/0001-81',
        billing_email: 'cobranca@acme.com',
        website: 'https://acme.com',
        address_line: 'Rua X, 10',
        address_city: 'São Paulo',
        address_state: 'SP',
        address_postal_code: '01000-000',
        source: 'Indicação',
      })
      .eq('id', clientId)
    expect(upd.error).toBeNull()
    const row = await a.client.from('clients').select('legal_name, tax_id, address_city, source').eq('id', clientId).single()
    expect(row.data).toEqual({ legal_name: 'Acme Ltda', tax_id: '11.222.333/0001-81', address_city: 'São Paulo', source: 'Indicação' })
  })

  it('rejeita site que não é http(s)', async () => {
    const bad = await a.client.from('clients').update({ website: 'javascript:alert(1)' }).eq('id', clientId)
    expect(bad.error?.code).toBe('23514')
  })

  it('documento, e-mail de cobrança e endereço ficam fora da trilha de atividade', async () => {
    const logs = await a.client.from('activity_logs').select('changes').eq('entity_id', clientId)
    const text = JSON.stringify(logs.data)
    expect(text).not.toMatch(/tax_id|billing_email|address_/)
  })

  it('só um contato principal por cliente', async () => {
    const ana = await a.client
      .from('client_contacts')
      .insert({ organization_id: a.orgId, client_id: clientId, name: 'Ana', email: 'ana@acme.com', is_primary: true })
      .select('id')
      .single()
    expect(ana.error).toBeNull()
    const bruno = await a.client
      .from('client_contacts')
      .insert({ organization_id: a.orgId, client_id: clientId, name: 'Bruno', whatsapp: '(11) 91234-5678', is_primary: true })
      .select('id')
      .single()
    expect(bruno.error).toBeNull()
    const list = await a.client.from('client_contacts').select('name, is_primary').order('name')
    expect(list.data).toEqual([
      { name: 'Ana', is_primary: false },
      { name: 'Bruno', is_primary: true },
    ])
  })

  it('B não enxerga, não referencia o cliente de A nem apaga contatos de A', async () => {
    expect((await b.client.from('client_contacts').select('id')).data).toEqual([])
    const fk = await b.client
      .from('client_contacts')
      .insert({ organization_id: b.orgId, client_id: clientId, name: 'Cruzado' })
    expect(fk.error?.code).toBe('23503')
    const del = await b.client.from('client_contacts').delete().eq('client_id', clientId).select('id')
    expect(del.data).toEqual([])
  })

  it('o owner remove um contato', async () => {
    const del = await a.client.from('client_contacts').delete().eq('name', 'Ana').select('id')
    expect(del.data).toHaveLength(1)
  })
})

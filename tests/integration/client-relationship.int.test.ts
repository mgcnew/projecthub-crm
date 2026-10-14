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

describe('relacionamento com o cliente com sessões reais', () => {
  let a: Awaited<ReturnType<typeof signUp>>
  let b: Awaited<ReturnType<typeof signUp>>
  let clientId: string
  let otherClientId: string
  let contactId: string
  let interactionId: string

  beforeAll(async () => {
    a = await signUp('rel-a')
    b = await signUp('rel-b')
    const c1 = await a.client.from('clients').insert({ organization_id: a.orgId, name: 'Cliente R1' }).select('id').single()
    const c2 = await a.client.from('clients').insert({ organization_id: a.orgId, name: 'Cliente R2' }).select('id').single()
    clientId = c1.data!.id
    otherClientId = c2.data!.id
    const ct = await a.client
      .from('client_contacts')
      .insert({ organization_id: a.orgId, client_id: clientId, name: 'Ana' })
      .select('id')
      .single()
    contactId = ct.data!.id
  })

  it('agenda o próximo contato e lê os vencidos para a Central do dia', async () => {
    const upd = await a.client
      .from('clients')
      .update({ next_contact_on: '2020-01-15', next_contact_note: 'Cobrar retorno' })
      .eq('id', clientId)
    expect(upd.error).toBeNull()
    const due = await a.client
      .from('clients')
      .select('id, name, next_contact_on, next_contact_note')
      .is('archived_at', null)
      .not('next_contact_on', 'is', null)
      .lte('next_contact_on', '2030-01-01')
    expect(due.data).toEqual([
      { id: clientId, name: 'Cliente R1', next_contact_on: '2020-01-15', next_contact_note: 'Cobrar retorno' },
    ])
  })

  it('registra interação com o nome do contato embutido', async () => {
    const ins = await a.client
      .from('client_interactions')
      .insert({ organization_id: a.orgId, client_id: clientId, contact_id: contactId, kind: 'call', summary: 'Alinhou prazo' })
      .select('id')
      .single()
    expect(ins.error).toBeNull()
    interactionId = ins.data!.id
    const list = await a.client
      .from('client_interactions')
      .select('id, kind, summary, client_contacts(name)')
      .eq('client_id', clientId)
    expect(list.data).toEqual([{ id: interactionId, kind: 'call', summary: 'Alinhou prazo', client_contacts: { name: 'Ana' } }])
  })

  it('o contato precisa ser do mesmo cliente', async () => {
    const bad = await a.client
      .from('client_interactions')
      .insert({ organization_id: a.orgId, client_id: otherClientId, contact_id: contactId, summary: 'x' })
    expect(bad.error?.code).toBe('23503')
  })

  it('guarda links de documento e recusa esquemas perigosos', async () => {
    const ok = await a.client
      .from('client_documents')
      .insert({ organization_id: a.orgId, client_id: clientId, title: 'Contrato', url: 'https://drive.google.com/x', kind: 'contract' })
    expect(ok.error).toBeNull()
    const bad = await a.client
      .from('client_documents')
      .insert({ organization_id: a.orgId, client_id: clientId, title: 'Mau', url: 'javascript:alert(1)' })
    expect(bad.error?.code).toBe('23514')
  })

  it('apagar o contato mantém a interação, sem o vínculo', async () => {
    const del = await a.client.from('client_contacts').delete().eq('id', contactId).select('id')
    expect(del.error).toBeNull()
    const row = await a.client.from('client_interactions').select('summary, contact_id').eq('id', interactionId).single()
    expect(row.data).toEqual({ summary: 'Alinhou prazo', contact_id: null })
  })

  it('B não enxerga, não altera e não referencia o cliente de A', async () => {
    expect((await b.client.from('client_interactions').select('id')).data).toEqual([])
    expect((await b.client.from('client_documents').select('id')).data).toEqual([])
    const upd = await b.client.from('client_interactions').update({ summary: 'Invadido' }).eq('id', interactionId).select('id')
    expect(upd.data).toEqual([])
    const fk = await b.client
      .from('client_interactions')
      .insert({ organization_id: b.orgId, client_id: clientId, summary: 'Cruzado' })
    expect(fk.error?.code).toBe('23503')
  })
})

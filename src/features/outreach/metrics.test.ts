import { convertedSince, percent, replyRates, stageCounts, type ReplyRow, type SentRow } from './metrics'

const sent = (lead: string, at: string, extra: Partial<SentRow> = {}): SentRow => ({
  lead_id: lead,
  sent_at: at,
  channel: 'email',
  temperature: 'cold',
  template_id: 't1',
  template_name: 'Primeiro contato',
  campaign_id: 'c1',
  campaign_name: 'Pedidos',
  ...extra,
})

describe('replyRates', () => {
  const rows = [
    sent('a', '2026-11-01T10:00:00Z'),
    sent('a', '2026-11-04T10:00:00Z'), // lembrete: o lead "a" conta uma vez só
    sent('b', '2026-11-01T10:00:00Z'),
    sent('c', '2026-11-01T10:00:00Z', { channel: 'whatsapp', temperature: 'warm', campaign_id: 'c2', campaign_name: 'Zap', template_id: 't2', template_name: 'Zap quente' }),
  ]
  const replies: ReplyRow[] = [
    { lead_id: 'a', received_at: '2026-11-02T09:00:00Z' },
    { lead_id: 'c', received_at: '2026-10-30T09:00:00Z' }, // resposta ANTES do envio: não conta
    { lead_id: 'zzz', received_at: '2026-11-02T09:00:00Z' }, // lead que nunca recebeu envio: não conta
  ]

  it('taxa por campanha: leads que responderam ÷ leads contatados', () => {
    const r = replyRates(rows, replies, 'campaign')
    expect(r.map((x) => [x.label, x.contacted, x.replied, x.rate])).toEqual([
      ['Pedidos', 2, 1, 0.5],
      ['Zap', 1, 0, 0],
    ])
  })

  it('por modelo, canal e temperatura', () => {
    expect(replyRates(rows, replies, 'template').map((x) => x.label)).toEqual(['Primeiro contato', 'Zap quente'])
    expect(replyRates(rows, replies, 'channel').map((x) => [x.label, x.contacted])).toEqual([['E-mail', 2], ['WhatsApp', 1]])
    expect(replyRates(rows, replies, 'temperature').map((x) => [x.label, x.replied])).toEqual([['Frios', 1], ['Mornos', 0]])
  })

  it('sem envios não há grupos; envio sem campanha ou modelo vira "Sem …"', () => {
    expect(replyRates([], replies, 'campaign')).toEqual([])
    const r = replyRates([sent('a', '2026-11-01T10:00:00Z', { campaign_id: null, campaign_name: null })], [], 'campaign')
    expect(r[0].label).toBe('Sem campanha')
    expect(r[0].rate).toBe(0)
  })
})

describe('funil e conversões', () => {
  it('stageCounts segue a ordem do funil e mostra etapas vazias com 0', () => {
    const r = stageCounts([{ stage: 'new' }, { stage: 'new' }, { stage: 'won' }, { stage: 'replied' }])
    expect(r.map((x) => x.stage)).toEqual(['new', 'contacted', 'replied', 'meeting', 'proposal', 'won', 'lost'])
    expect(r.map((x) => x.count)).toEqual([2, 0, 1, 0, 0, 1, 0])
  })
  it('convertedSince conta só a partir do início do mês', () => {
    const leads = [{ converted_at: '2026-11-03T12:00:00Z' }, { converted_at: '2026-10-31T23:00:00Z' }, { converted_at: null }]
    expect(convertedSince(leads, '2026-11-01')).toBe(1)
  })
  it('percent arredonda', () => {
    expect(percent(0.5)).toBe('50%')
    expect(percent(1 / 3)).toBe('33%')
  })
})

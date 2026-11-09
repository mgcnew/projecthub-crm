import { campaignDefaults, campaignFormSchema, campaignPayload, templateFormSchema, templateDefaults, templatePayload } from './schema'

const base = { ...campaignDefaults, name: 'Camp', step1_template_id: 't1' }
const issues = (v: typeof base) => {
  const r = campaignFormSchema.safeParse(v)
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
}

describe('campaignFormSchema', () => {
  it('o padrão (D+3 e D+7) é válido', () => {
    expect(issues(base)).toEqual([])
    expect(campaignPayload({ ...base, step2_template_id: 't2', step3_template_id: 't3' })).toMatchObject({
      followup_days: [3, 7],
      step2_template_id: 't2',
      step3_template_id: 't3',
      daily_limit: 20,
    })
  })
  it('os lembretes seguem em ordem crescente e só existem em sequência', () => {
    expect(issues({ ...base, followup_1: '7', followup_2: '3' })).toContain('followup_2: O 2º lembrete vem depois do 1º')
    expect(issues({ ...base, followup_1: '', followup_2: '5' })).toContain('followup_1: Preencha o 1º lembrete antes do 2º')
    expect(issues({ ...base, followup_1: '70' })[0]).toContain('followup_1')
  })
  it('modelo de passo sem o lembrete correspondente é recusado; o payload os ignora', () => {
    expect(issues({ ...base, followup_1: '', followup_2: '', step2_template_id: 't2' })).toContain('step2_template_id: Sem 1º lembrete não há modelo do passo 2')
    expect(campaignPayload({ ...base, followup_1: '3', followup_2: '', step3_template_id: 't3' })).toMatchObject({ followup_days: [3], step3_template_id: null })
  })
  it('WhatsApp exige público morno ou quente; o limite diário fica entre 1 e 100', () => {
    expect(issues({ ...base, channel: 'whatsapp' })).toContain('temperature: WhatsApp é só para lead morno ou quente')
    expect(issues({ ...base, channel: 'whatsapp', temperature: 'warm' })).toEqual([])
    expect(issues({ ...base, daily_limit: '0' }).join()).toContain('daily_limit')
    expect(issues({ ...base, daily_limit: '101' }).join()).toContain('daily_limit')
  })
})

describe('templateFormSchema / templatePayload', () => {
  const t = { ...templateDefaults, name: 'M', subject: 'Oi', body: 'Corpo' }
  it('e-mail exige assunto; WhatsApp exige morno/quente e não leva assunto', () => {
    expect(templateFormSchema.safeParse({ ...t, subject: '' }).success).toBe(false)
    expect(templateFormSchema.safeParse({ ...t, channel: 'whatsapp' }).success).toBe(false)
    const zap = { ...t, channel: 'whatsapp' as const, temperature: 'warm' as const }
    expect(templateFormSchema.safeParse(zap).success).toBe(true)
    expect(templatePayload(zap).subject).toBeNull()
  })
  it('variações: uma por linha, sem linhas vazias, no máximo 10', () => {
    expect(templatePayload({ ...t, openings: 'Oi\n\n  Olá  \n' }).openings).toEqual(['Oi', 'Olá'])
    expect(templateFormSchema.safeParse({ ...t, openings: Array.from({ length: 11 }, (_, i) => `a${i}`).join('\n') }).success).toBe(false)
    expect(templateFormSchema.safeParse({ ...t, closings: 'x'.repeat(301) }).success).toBe(false)
  })
})

import { projectFormSchema, projectPayload, projectDefaults } from './schema'

describe('projectFormSchema', () => {
  it('aceita projeto sem cliente e sem datas', () => {
    expect(projectFormSchema.safeParse({ ...projectDefaults, name: 'X' }).success).toBe(true)
  })
  it('rejeita prazo anterior ao início', () => {
    const r = projectFormSchema.safeParse({ ...projectDefaults, name: 'X', started_on: '2026-10-10', target_date: '2026-10-01' })
    expect(r.success).toBe(false)
  })
  it('converte vazios em null no payload', () => {
    expect(projectPayload({ ...projectDefaults, name: ' X ' })).toMatchObject({
      name: 'X',
      client_id: null,
      started_on: null,
      target_date: null,
      description: null,
    })
  })
})

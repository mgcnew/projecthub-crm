import { describe, expect, it } from 'vitest'
import { notificationHref, offsetLabel, reminderOffsets, validateReminderAt } from './schema'

describe('validateReminderAt', () => {
  const now = new Date('2026-10-13T12:00:00')

  it('exige valor', () => {
    expect(validateReminderAt('', now)).toMatch(/Informe/)
  })

  it('rejeita data inválida', () => {
    expect(validateReminderAt('lixo', now)).toMatch(/inválidas/)
  })

  it('rejeita passado e aceita futuro', () => {
    expect(validateReminderAt('2026-10-13T11:00', now)).toMatch(/futuro/)
    expect(validateReminderAt('2026-10-13T12:30', now)).toBeNull()
  })

  it('tolera 1 minuto de atraso, como o servidor', () => {
    expect(validateReminderAt('2026-10-13T11:59:30', now)).toBeNull()
  })
})

describe('offsetLabel', () => {
  it('usa o rótulo conhecido e cai para minutos', () => {
    expect(offsetLabel(60)).toBe('1 hora antes')
    expect(offsetLabel(45)).toBe('45 minutos antes')
  })

  it('todas as antecedências oferecidas respeitam o limite do banco', () => {
    for (const o of reminderOffsets) {
      expect(o.value).toBeGreaterThanOrEqual(0)
      expect(o.value).toBeLessThanOrEqual(10080)
    }
  })
})

describe('notificationHref', () => {
  it('aponta para a tarefa, o evento ou nada', () => {
    expect(notificationHref({ task_id: 't1', event_id: null })).toBe('/app/tarefas/t1')
    expect(notificationHref({ task_id: null, event_id: 'e1' })).toBe('/app/agenda/e1')
    expect(notificationHref({ task_id: null, event_id: null })).toBeNull()
  })
})

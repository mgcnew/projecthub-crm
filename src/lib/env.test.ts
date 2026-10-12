import { parseEnv } from './env'

describe('parseEnv', () => {
  it('aceita URL e chave publicável', () => {
    const r = parseEnv({ VITE_SUPABASE_URL: 'http://127.0.0.1:54321', VITE_SUPABASE_PUBLISHABLE_KEY: 'k' })
    expect(r.success).toBe(true)
  })
  it('rejeita variáveis ausentes', () => {
    expect(parseEnv({}).success).toBe(false)
  })
  it('rejeita URL inválida', () => {
    expect(parseEnv({ VITE_SUPABASE_URL: 'nao-url', VITE_SUPABASE_PUBLISHABLE_KEY: 'k' }).success).toBe(false)
  })
})

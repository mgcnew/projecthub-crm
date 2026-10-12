import { cn } from './utils'

describe('cn', () => {
  it('mescla classes e resolve conflitos do Tailwind', () => {
    expect(cn('px-2', false, 'px-4')).toBe('px-4')
  })
})

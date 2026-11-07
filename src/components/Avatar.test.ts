import { initials } from './Avatar'

describe('initials', () => {
  it('usa a primeira e a última palavra do nome', () => {
    expect(initials('Maria da Silva')).toBe('MS')
    expect(initials('  joão   pedro  souza ')).toBe('JS')
  })
  it('com uma palavra usa até duas letras', () => {
    expect(initials('Marcelo')).toBe('MA')
    expect(initials('é')).toBe('É')
  })
  it('sem nome cai na primeira letra do e-mail, ou em ?', () => {
    expect(initials('', 'dev@projecthub.local')).toBe('D')
    expect(initials(null, null)).toBe('?')
  })
})

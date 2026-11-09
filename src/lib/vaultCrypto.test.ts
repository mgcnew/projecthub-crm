// @vitest-environment node
import {
  createVaultMaterial,
  decryptSecret,
  deriveKeys,
  encryptSecret,
  fromBytea,
  importDek,
  masterPasswordIssues,
  toBytea,
  unwrapDek,
  wrapDek,
} from './vaultCrypto'

const FAST = 1000 // iterações reduzidas só nos testes (o app usa 600.000)

describe('vaultCrypto', () => {
  it('a mesma senha e sal dão a mesma chave e prova; outra senha, outras', async () => {
    const salt = new Uint8Array(16).fill(7)
    const a = await deriveKeys('correta horse battery 9', salt, FAST)
    const b = await deriveKeys('correta horse battery 9', salt, FAST)
    const c = await deriveKeys('correta horse battery 8', salt, FAST)
    expect(Buffer.from(a.clientKey)).toEqual(Buffer.from(b.clientKey))
    expect(Buffer.from(a.proof)).toEqual(Buffer.from(b.proof))
    expect(Buffer.from(a.proof)).not.toEqual(Buffer.from(c.proof))
    expect(Buffer.from(a.clientKey)).not.toEqual(Buffer.from(a.proof))
    expect(a.clientKey).toHaveLength(32)
    expect(a.proof).toHaveLength(32)
  })

  it('normaliza a senha (NFKC): "é" composto e decomposto valem o mesmo', async () => {
    const salt = new Uint8Array(16)
    const x = await deriveKeys('café secreto 123A', salt, FAST)
    const y = await deriveKeys('café secreto 123A', salt, FAST)
    expect(Buffer.from(x.proof)).toEqual(Buffer.from(y.proof))
  })

  it('a DEK só abre com a chave do cliente E a parte do servidor certas', async () => {
    const m = await createVaultMaterial('Uma frase longa 12345', FAST)
    const { clientKey } = await deriveKeys('Uma frase longa 12345', m.salt, FAST)
    expect(m.wrappedDek).toHaveLength(48)
    const dek = await unwrapDek(clientKey, m.share, m.wrappedDek, m.dekIv)
    expect(Buffer.from(dek)).toEqual(Buffer.from(m.dek))

    const wrongShare = new Uint8Array(32).fill(1)
    await expect(unwrapDek(clientKey, wrongShare, m.wrappedDek, m.dekIv)).rejects.toThrow()
    const other = await deriveKeys('Outra frase longa 12345', m.salt, FAST)
    await expect(unwrapDek(other.clientKey, m.share, m.wrappedDek, m.dekIv)).rejects.toThrow()
  })

  it('cifra e decifra o item; outro acesso, DEK errada ou adulteração falham', async () => {
    const m = await createVaultMaterial('Uma frase longa 12345', FAST)
    const dek = await importDek(m.dek)
    const sealed = await encryptSecret(dek, 'acesso-1', { password: 's3nh@-ç', notes: 'token de ligação' })
    expect(sealed.iv).toHaveLength(12)
    expect(await decryptSecret(dek, 'acesso-1', sealed)).toEqual({ password: 's3nh@-ç', notes: 'token de ligação' })

    await expect(decryptSecret(dek, 'acesso-2', sealed)).rejects.toThrow() // item não vale em outro acesso
    const otherDek = await importDek(new Uint8Array(32).fill(9))
    await expect(decryptSecret(otherDek, 'acesso-1', sealed)).rejects.toThrow()
    const tampered = { iv: sealed.iv, data: sealed.data.slice() }
    tampered.data[0] ^= 1
    await expect(decryptSecret(dek, 'acesso-1', tampered)).rejects.toThrow()
  })

  it('cada cifragem usa um IV novo (mesmo conteúdo, texto cifrado diferente)', async () => {
    const dek = await importDek(new Uint8Array(32).fill(3))
    const a = await encryptSecret(dek, 'x', { password: 'igual', notes: '' })
    const b = await encryptSecret(dek, 'x', { password: 'igual', notes: '' })
    expect(Buffer.from(a.iv)).not.toEqual(Buffer.from(b.iv))
    expect(Buffer.from(a.data)).not.toEqual(Buffer.from(b.data))
  })

  it('trocar a senha mestra: embrulha a mesma DEK de novo e a antiga deixa de servir', async () => {
    const m = await createVaultMaterial('Frase antiga longa 111', FAST)
    const next = await deriveKeys('Frase nova longa 222', m.salt, FAST)
    const rewrapped = await wrapDek(next.clientKey, m.share, m.dek)
    expect(Buffer.from(await unwrapDek(next.clientKey, m.share, rewrapped.data, rewrapped.iv))).toEqual(Buffer.from(m.dek))
    const old = await deriveKeys('Frase antiga longa 111', m.salt, FAST)
    await expect(unwrapDek(old.clientKey, m.share, rewrapped.data, rewrapped.iv)).rejects.toThrow()
  })

  it('bytea de ida e volta', () => {
    const b = new Uint8Array([0, 1, 254, 255, 16])
    expect(toBytea(b)).toBe('\\x0001feff10')
    expect(Array.from(fromBytea('\\x0001feff10'))).toEqual(Array.from(b))
  })

  it('regras da senha mestra', () => {
    expect(masterPasswordIssues('curta')).toHaveLength(2)
    expect(masterPasswordIssues('uma frase bem longa sem maiusculas 1')).toHaveLength(1)
    expect(masterPasswordIssues('Uma frase bem longa com 1 numero')).toHaveLength(0)
  })
})

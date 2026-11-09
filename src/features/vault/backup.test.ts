// @vitest-environment node
import { createVaultMaterial, decryptSecret, deriveKeys, encryptSecret, importDek, randomBytes } from '@/lib/vaultCrypto'
import { BackupError, buildBackup, openBackup } from './backup'

const FAST = 1000

describe('backup do cofre', () => {
  it('ida e volta: abre a DEK e os itens com a senha mestra, sem a parte do servidor', async () => {
    const m = await createVaultMaterial('Frase do backup longa 123', FAST)
    const key = await importDek(m.dek)
    const sealed = await encryptSecret(key, 'acesso-1', { password: 'abc', notes: 'n' })
    // O arquivo real sempre carrega o custo do app (600.000); só a derivação da chave é refeita aqui.
    const keys600 = await deriveKeys('Frase do backup longa 123', m.salt, 600_000)
    const real = await buildBackup({ clientKey: keys600.clientKey, salt: m.salt, iterations: 600_000, dek: m.dek, items: [] })
    const opened = await openBackup(JSON.parse(JSON.stringify(real)), 'Frase do backup longa 123')
    expect(Buffer.from(opened.dek)).toEqual(Buffer.from(m.dek))
    expect(opened.items).toEqual([])
    // O item cifrado vale com a DEK recuperada.
    const reopened = await importDek(opened.dek)
    expect(await decryptSecret(reopened, 'acesso-1', sealed)).toEqual({ password: 'abc', notes: 'n' })
  })

  it('senha errada e arquivo inválido são erros distintos', async () => {
    const salt = randomBytes(16)
    const m = await createVaultMaterial('Frase certa longa 123', 600_000)
    const keys = await deriveKeys('Frase certa longa 123', m.salt, 600_000)
    const file = await buildBackup({ clientKey: keys.clientKey, salt, iterations: 600_000, dek: m.dek, items: [] })
    // sal diferente do usado na chave: a abertura falha como "senha"
    await expect(openBackup(JSON.parse(JSON.stringify(file)), 'Frase certa longa 123')).rejects.toMatchObject({ reason: 'password' })
    await expect(openBackup({ format: 'outro' }, 'x')).rejects.toBeInstanceOf(BackupError)
    await expect(openBackup({ format: 'outro' }, 'x')).rejects.toMatchObject({ reason: 'invalid' })
  })
})

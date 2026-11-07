import { Download, Upload } from 'lucide-react'
import { useState } from 'react'
import { Field } from '@/components/form'
import { controlClass } from '@/components/form-styles'
import { Plate } from '@/components/Plate'
import { Button } from '@/components/ui/button'
import { useCurrentWorkspace } from '@/features/workspace/useCurrentWorkspace'
import { supabase } from '@/lib/supabase'
import { deriveKeys, fromBytea, importDek, randomBytes, toBytea, unwrapDek, wrapDek } from '@/lib/vaultCrypto'
import { rpcUnlock, useSetupVault } from './api'
import { BackupError, buildBackup, openBackup, type BackupItem } from './backup'
import { useVault } from './vault-context'

const MAX_FILE = 5 * 1024 * 1024

function download(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Exporta o cofre para um arquivo criptografado (a ser guardado fora do app). */
export function ExportBackup() {
  const { orgId } = useCurrentWorkspace()
  const vault = useVault()
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const meta = vault.meta
    if (!orgId || !meta || !password) return
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const keys = await deriveKeys(password, meta.salt, meta.iterations)
      const res = await rpcUnlock(orgId, keys.proof)
      if (res.status !== 'ok' || !res.share) {
        setError(
          res.status === 'wrong'
            ? `Senha mestra incorreta. Restam ${res.attemptsLeft ?? 0} tentativas antes de o cofre ser destruído.`
            : res.status === 'locked'
              ? 'O cofre está bloqueado por erros seguidos. Tente de novo mais tarde.'
              : 'Não foi possível abrir o cofre para exportar.',
        )
        return
      }
      const dek = await unwrapDek(keys.clientKey, res.share, meta.wrappedDek, meta.dekIv)
      const rows = await supabase.from('vault_items').select('access_id, iv, ciphertext').limit(2000)
      if (rows.error) throw rows.error
      const ids = (rows.data ?? []).map((r) => r.access_id)
      const names = ids.length ? await supabase.from('access_entries').select('id, name').in('id', ids) : { data: [], error: null }
      if (names.error) throw names.error
      const nameOf = new Map((names.data ?? []).map((n) => [n.id, n.name]))
      const items: BackupItem[] = (rows.data ?? []).map((r) => ({
        accessId: r.access_id,
        accessName: nameOf.get(r.access_id) ?? '',
        iv: fromBytea(r.iv),
        data: fromBytea(r.ciphertext),
      }))
      const file = await buildBackup({ clientKey: keys.clientKey, salt: meta.salt, iterations: meta.iterations, dek, items })
      dek.fill(0)
      download(`cofre-voltier-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(file))
      setMessage(`Backup criado com ${items.length} senha${items.length === 1 ? '' : 's'}. Guarde o arquivo fora do app; para abri-lo é preciso a senha mestra de hoje.`)
      setPassword('')
    } catch {
      setError('Não foi possível criar o backup. Tente de novo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Plate id="vault-export-h" title="Backup do cofre">
      <form onSubmit={submit} noValidate className="max-w-xl space-y-3">
        <p className="text-sm text-muted-foreground">
          O backup do banco de dados <strong className="text-foreground">não</strong> leva o cofre (a parte da chave que fica no servidor fica de fora).
          Por isso, exporte um arquivo criptografado e guarde-o fora do app (pendrive, outro armazenamento). Ele só abre com a sua senha mestra.
        </p>
        <Field id="export-password" label="Senha mestra">
          <input id="export-password" type="password" autoComplete="off" className={controlClass} value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} />
        </Field>
        <Button type="submit" variant="outline" disabled={busy || !password}>
          <Download aria-hidden="true" />
          {busy ? 'Criando o backup…' : 'Exportar backup'}
        </Button>
        {message && (
          <p role="status" className="text-sm text-tone-success">
            {message}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </form>
    </Plate>
  )
}

/** Recria o cofre a partir de um arquivo de backup (com a senha mestra usada na exportação). */
export function RestoreBackup({ onDone }: { onDone: (message: string) => void }) {
  const { orgId } = useCurrentWorkspace()
  const vault = useVault()
  const setup = useSetupVault()
  const [file, setFile] = useState<File | null>(null)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!orgId || !file || !password) return
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      if (file.size > MAX_FILE) throw new BackupError('invalid')
      let json: unknown
      try {
        json = JSON.parse(await file.text())
      } catch {
        throw new BackupError('invalid')
      }
      const opened = await openBackup(json, password)
      const share = randomBytes(32)
      const wrapped = await wrapDek(opened.clientKey, share, opened.dek)
      await setup.mutateAsync({
        orgId,
        salt: opened.salt,
        iterations: opened.iterations,
        proof: opened.proof,
        share,
        wrappedDek: wrapped.data,
        dekIv: wrapped.iv,
        maxAttempts: 5,
      })
      // Só os acessos que ainda existem recebem o item de volta.
      const ids = opened.items.map((i) => i.accessId)
      const existing = ids.length ? await supabase.from('access_entries').select('id').in('id', ids) : { data: [], error: null }
      if (existing.error) throw existing.error
      const alive = new Set((existing.data ?? []).map((r) => r.id))
      const rows = opened.items
        .filter((i) => alive.has(i.accessId))
        .map((i) => ({ organization_id: orgId, access_id: i.accessId, iv: toBytea(i.iv), ciphertext: toBytea(i.data) }))
      if (rows.length) {
        const ins = await supabase.from('vault_items').insert(rows)
        if (ins.error) throw ins.error
      }
      vault.adopt(await importDek(opened.dek))
      const skipped = opened.items.length - rows.length
      onDone(
        `Cofre restaurado com ${rows.length} senha${rows.length === 1 ? '' : 's'}${skipped ? ` (${skipped} ignorada${skipped === 1 ? '' : 's'}: o acesso não existe mais)` : ''}.`,
      )
      setPassword('')
      setFile(null)
    } catch (err) {
      setError(
        err instanceof BackupError
          ? err.reason === 'password'
            ? 'Senha mestra do backup incorreta.'
            : 'Esse arquivo não é um backup válido do cofre.'
          : 'Não foi possível restaurar o cofre. Tente de novo.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Plate id="vault-restore-h" title="Restaurar de um backup">
      <form onSubmit={submit} noValidate className="max-w-xl space-y-3">
        <p className="text-sm text-muted-foreground">Já exportou o cofre antes? Escolha o arquivo e digite a senha mestra usada naquela exportação.</p>
        <Field id="restore-file" label="Arquivo de backup (.json)">
          <input
            id="restore-file"
            type="file"
            accept="application/json,.json"
            className={controlClass + ' py-1.5'}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            disabled={busy}
          />
        </Field>
        <Field id="restore-password" label="Senha mestra do backup">
          <input id="restore-password" type="password" autoComplete="off" className={controlClass} value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} />
        </Field>
        <Button type="submit" variant="outline" disabled={busy || !file || !password}>
          <Upload aria-hidden="true" />
          {busy ? 'Restaurando…' : 'Restaurar cofre'}
        </Button>
        {message && (
          <p role="status" className="text-sm text-tone-success">
            {message}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </form>
    </Plate>
  )
}

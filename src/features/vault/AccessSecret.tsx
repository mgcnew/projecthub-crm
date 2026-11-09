import { zodResolver } from '@hookform/resolvers/zod'
import { Check, Copy, Eye, EyeOff, KeyRound, Lock } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Field } from '@/components/form'
import { controlClass, textareaClass } from '@/components/form-styles'
import { Plate } from '@/components/Plate'
import { Button } from '@/components/ui/button'
import { useCurrentWorkspace } from '@/features/workspace/useCurrentWorkspace'
import { decryptSecret, encryptSecret, type VaultSecret } from '@/lib/vaultCrypto'
import { useDeleteVaultItem, useSaveVaultItem, useVaultItem } from './api'
import { secretSchema, type SecretValues } from './schema'
import { useVault } from './vault-context'

const REVEAL_MS = 15_000
const CLIPBOARD_MS = 30_000

/** Copia a senha e, depois de 30 s, sobrescreve a área de transferência (como os gerenciadores de senha). */
function CopySecret({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      timers.current.push(setTimeout(() => setCopied(false), 2000))
      timers.current.push(setTimeout(() => void navigator.clipboard.writeText('').catch(() => {}), CLIPBOARD_MS))
    } catch {
      setCopied(false)
    }
  }
  return (
    <>
      <Button type="button" variant="outline" aria-label={label} onClick={copy}>
        {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        {copied ? 'Copiado' : 'Copiar'}
      </Button>
      <span role="status" className="sr-only">
        {copied ? 'Senha copiada; a área de transferência é limpa em 30 segundos' : ''}
      </span>
    </>
  )
}

/** Aba "Senha" de um acesso: a senha e as notas cifradas ficam no cofre; o servidor só guarda texto cifrado. */
export function AccessSecret({ accessId, accessName }: { accessId: string; accessName: string }) {
  const { orgId, canWrite } = useCurrentWorkspace()
  const vault = useVault()
  const item = useVaultItem(accessId, vault.unlocked)
  const save = useSaveVaultItem(orgId, accessId)
  const remove = useDeleteVaultItem(orgId, accessId)
  const [editing, setEditing] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [plain, setPlain] = useState<{ source: unknown; secret: VaultSecret | null } | null>(null)

  const dek = vault.dek
  useEffect(() => {
    if (!dek || !item.data) return
    let alive = true
    decryptSecret(dek, accessId, item.data)
      .then((secret) => alive && setPlain({ source: item.data, secret }))
      .catch(() => alive && setPlain({ source: item.data, secret: null }))
    return () => {
      alive = false
    }
  }, [dek, accessId, item.data])
  const current = plain && plain.source === item.data ? plain : null

  useEffect(() => {
    if (!revealed) return
    const t = setTimeout(() => setRevealed(false), REVEAL_MS)
    return () => clearTimeout(t)
  }, [revealed])

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SecretValues>({ resolver: zodResolver(secretSchema), defaultValues: { password: '', notes: '' } })

  const submit = handleSubmit(async (v) => {
    if (!vault.dek) return
    setError(null)
    setMessage(null)
    try {
      await save.mutateAsync(await encryptSecret(vault.dek, accessId, v))
      reset({ password: '', notes: '' })
      setEditing(false)
      setRevealed(false)
      setMessage('Senha guardada no cofre.')
    } catch {
      setError('Não foi possível guardar a senha. Tente de novo.')
    }
  })

  const body = () => {
    if (!vault.ready || (vault.unlocked && item.isPending)) return <p className="text-sm text-muted-foreground">Carregando…</p>
    if (!canWrite) return <p className="text-sm text-muted-foreground">Só o proprietário do espaço de trabalho vê as senhas do cofre.</p>
    if (!vault.exists) {
      return (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Você ainda não criou o cofre. Com ele, a senha deste acesso fica criptografada no seu navegador e o servidor não consegue lê-la.
          </p>
          <Button asChild>
            <Link to="/app/configuracoes?aba=cofre">Criar o cofre</Link>
          </Button>
        </div>
      )
    }
    if (!vault.unlocked) {
      return (
        <div className="space-y-3">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Lock aria-hidden="true" className="size-4 shrink-0" />O cofre está trancado.
          </p>
          <Button onClick={() => void vault.ensureUnlocked()}>Destrancar o cofre</Button>
        </div>
      )
    }
    if (item.isError) return <p role="alert" className="text-sm text-destructive">Não foi possível carregar a senha.</p>

    if (item.data && !editing) {
      if (!current) return <p className="text-sm text-muted-foreground">Abrindo…</p>
      if (!current.secret) {
        return (
          <p role="alert" className="text-sm text-destructive">
            Não foi possível ler esta senha (o texto guardado não confere com a chave do cofre).
          </p>
        )
      }
      const secret = current.secret
      return (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Senha</p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 rounded-md bg-muted px-3 py-2 font-mono text-sm break-all" data-testid="secret-value">
                {revealed ? secret.password : '••••••••••••'}
              </span>
              <Button type="button" variant="outline" aria-pressed={revealed} onClick={() => setRevealed((r) => !r)}>
                {revealed ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                {revealed ? 'Ocultar' : 'Mostrar'}
              </Button>
              <CopySecret text={secret.password} label={`Copiar a senha de ${accessName}`} />
            </div>
            <p className="text-xs text-muted-foreground">A senha se oculta sozinha em 15 segundos.</p>
          </div>
          {secret.notes && (
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Notas</p>
              <p className="text-sm whitespace-pre-wrap">{secret.notes}</p>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => {
                reset({ password: secret.password, notes: secret.notes })
                setEditing(true)
                setMessage(null)
              }}
            >
              Editar
            </Button>
            <Button variant="outline" onClick={() => setConfirmRemove(true)}>
              Remover do cofre
            </Button>
          </div>
        </div>
      )
    }

    return (
      <form onSubmit={submit} noValidate className="space-y-4">
        <Field id="secret-password" label="Senha" error={errors.password?.message}>
          <input id="secret-password" type="password" autoComplete="off" className={controlClass} aria-invalid={errors.password ? true : undefined} {...register('password')} />
        </Field>
        <Field id="secret-notes" label="Notas (também criptografadas)" error={errors.notes?.message} hint="Ex.: perguntas de segurança. Não guarde aqui o segredo do autenticador (2FA).">
          <textarea id="secret-notes" className={textareaClass} {...register('notes')} />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Criptografando…' : 'Guardar no cofre'}
          </Button>
          {editing && (
            <Button type="button" variant="outline" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
          )}
        </div>
      </form>
    )
  }

  return (
    <>
      <Plate id="secret-h" title="Senha no cofre" action={<KeyRound aria-hidden="true" className="size-4 text-muted-foreground" />}>
        <div className="max-w-xl space-y-3">
          {body()}
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
        </div>
      </Plate>
      <ConfirmDialog
        open={confirmRemove}
        title={`Remover a senha de “${accessName}” do cofre?`}
        description="A senha e as notas guardadas são apagadas de vez. O acesso (endereço e usuário) continua na lista."
        confirmLabel="Remover do cofre"
        pending={remove.isPending}
        onCancel={() => setConfirmRemove(false)}
        onConfirm={async () => {
          try {
            await remove.mutateAsync()
            setMessage('Senha removida do cofre.')
          } catch {
            setError('Não foi possível remover a senha.')
          } finally {
            setConfirmRemove(false)
          }
        }}
      />
    </>
  )
}

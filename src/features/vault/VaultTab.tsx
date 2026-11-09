import { zodResolver } from '@hookform/resolvers/zod'
import { Lock, LockOpen, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Field } from '@/components/form'
import { controlClass } from '@/components/form-styles'
import { Plate } from '@/components/Plate'
import { IconChip, StatusBadge } from '@/components/states'
import { Button } from '@/components/ui/button'
import { useCurrentWorkspace } from '@/features/workspace/useCurrentWorkspace'
import { createVaultMaterial, deriveKeys, importDek, KDF_ITERATIONS, randomBytes, unwrapDek, wrapDek } from '@/lib/vaultCrypto'
import { rpcUnlock, useDestroyVault, useRekeyVault, useSetupVault } from './api'
import { ExportBackup, RestoreBackup } from './BackupSection'
import { ATTEMPT_OPTIONS, rekeySchema, setupSchema, type RekeyValues, type SetupValues } from './schema'
import { useVault } from './vault-context'

const timeFmt = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })

/** Aba "Cofre" das Configurações: criar, travar/destrancar, trocar a senha mestra e destruir. */
export function VaultTab() {
  const vault = useVault()
  const { canWrite } = useCurrentWorkspace()
  // O aviso de "destruído" mora aqui: a tela de status some quando o cofre deixa de existir.
  const [notice, setNotice] = useState<string | null>(null)
  if (!vault.ready) return <p className="text-sm text-muted-foreground">Carregando…</p>
  if (!canWrite) {
    return (
      <Plate id="vault-h" title="Cofre de senhas">
        <p className="text-sm text-muted-foreground">Só o proprietário do espaço de trabalho pode usar o cofre.</p>
      </Plate>
    )
  }
  return (
    <>
      {notice && (
        <p role="status" className="text-sm text-tone-success">
          {notice}
        </p>
      )}
      {vault.exists ? (
        <>
          <VaultStatus onNotice={setNotice} />
          <ExportBackup />
        </>
      ) : (
        <>
          <VaultSetup />
          <RestoreBackup onDone={setNotice} />
        </>
      )}
    </>
  )
}

function VaultSetup() {
  const { orgId } = useCurrentWorkspace()
  const vault = useVault()
  const setup = useSetupVault()
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SetupValues>({ resolver: zodResolver(setupSchema), defaultValues: { maxAttempts: '5', understood: false } })

  const submit = handleSubmit(async (v) => {
    if (!orgId) return
    setError(null)
    try {
      const m = await createVaultMaterial(v.password)
      await setup.mutateAsync({
        orgId,
        salt: m.salt,
        iterations: m.iterations,
        proof: m.proof,
        share: m.share,
        wrappedDek: m.wrappedDek,
        dekIv: m.dekIv,
        maxAttempts: Number(v.maxAttempts),
      })
      vault.adopt(await importDek(m.dek))
    } catch {
      setError('Não foi possível criar o cofre. Tente de novo.')
    }
  })

  return (
    <Plate id="vault-h" title="Cofre de senhas">
      <div className="max-w-xl space-y-4">
        <div className="flex items-start gap-3">
          <IconChip icon={ShieldCheck} tone="info" size="lg" />
          <p className="text-sm text-muted-foreground">
            Guarde a senha de cada acesso aqui. Tudo é criptografado <strong className="text-foreground">no seu navegador</strong>{' '}
            com uma senha mestra que o servidor nunca vê: nem o banco de dados consegue ler o conteúdo.
          </p>
        </div>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>
            <strong className="text-foreground">Sem recuperação:</strong> se você esquecer a senha mestra, as senhas guardadas se perdem.
          </li>
          <li>
            <strong className="text-foreground">Proteção contra tentativas:</strong> 3 erros seguidos bloqueiam por 15 minutos; ao
            chegar no limite escolhido abaixo, o cofre é destruído.
          </li>
          <li>O cofre fecha sozinho depois de 5 minutos sem uso.</li>
        </ul>
        <form onSubmit={submit} noValidate className="space-y-4">
          <Field id="vault-password" label="Senha mestra" error={errors.password?.message} hint="Uma frase longa que só você sabe. Use também um gerenciador de senhas para guardar esta frase.">
            <input id="vault-password" type="password" autoComplete="new-password" className={controlClass} aria-invalid={errors.password ? true : undefined} {...register('password')} />
          </Field>
          <Field id="vault-confirm" label="Repita a senha mestra" error={errors.confirm?.message}>
            <input id="vault-confirm" type="password" autoComplete="new-password" className={controlClass} aria-invalid={errors.confirm ? true : undefined} {...register('confirm')} />
          </Field>
          <Field id="vault-max" label="Erros seguidos que destroem o cofre" hint="Recomendado: 5. Com 3, não há bloqueio intermediário.">
            <select id="vault-max" className={controlClass} {...register('maxAttempts')}>
              {ATTEMPT_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n} erros{n === 5 ? ' (recomendado)' : ''}
                </option>
              ))}
            </select>
          </Field>
          <div className="space-y-1.5">
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-0.5 size-4" {...register('understood')} />
              Entendi que, se eu esquecer a senha mestra ou errar demais, o conteúdo do cofre se perde para sempre.
            </label>
            {errors.understood && <p className="text-sm text-destructive">{errors.understood.message}</p>}
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Gerando as chaves…' : 'Criar cofre'}
          </Button>
        </form>
      </div>
    </Plate>
  )
}

function VaultStatus({ onNotice }: { onNotice: (message: string | null) => void }) {
  const { orgId } = useCurrentWorkspace()
  const vault = useVault()
  const destroy = useDestroyVault()
  const meta = vault.meta!
  const [rekeyOpen, setRekeyOpen] = useState(false)
  const [confirmDestroy, setConfirmDestroy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const locked = meta.lockedUntil && new Date(meta.lockedUntil) > new Date() ? meta.lockedUntil : null

  return (
    <>
      <Plate
        id="vault-h"
        title="Cofre de senhas"
        action={<StatusBadge tone={vault.unlocked ? 'success' : 'neutral'}>{vault.unlocked ? 'Destrancado' : 'Trancado'}</StatusBadge>}
      >
        <div className="max-w-xl space-y-4">
          <p className="text-sm text-muted-foreground">
            As senhas ficam criptografadas no seu navegador. Erros seguidos de senha mestra:{' '}
            <strong className="text-foreground tabular-nums">
              {meta.failedAttempts} de {meta.maxAttempts}
            </strong>
            {locked && <> · bloqueado até {timeFmt.format(new Date(locked))}</>}. Ao chegar no limite, o cofre é destruído.
          </p>
          <div className="flex flex-wrap gap-2">
            {vault.unlocked ? (
              <Button variant="outline" onClick={vault.lock}>
                <Lock aria-hidden="true" /> Trancar agora
              </Button>
            ) : (
              <Button onClick={() => void vault.ensureUnlocked()}>
                <LockOpen aria-hidden="true" /> Destrancar
              </Button>
            )}
            <Button variant="outline" onClick={() => setRekeyOpen((o) => !o)} aria-expanded={rekeyOpen}>
              Trocar a senha mestra
            </Button>
            <Button variant="outline" onClick={() => setConfirmDestroy(true)}>
              Destruir o cofre
            </Button>
          </div>
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

      {rekeyOpen && (
        <RekeyForm
          onDone={() => {
            setRekeyOpen(false)
            setMessage('Senha mestra trocada.')
          }}
        />
      )}

      <ConfirmDialog
        open={confirmDestroy}
        title="Destruir o cofre?"
        description="Todas as senhas guardadas são apagadas de vez e não há como recuperá-las. Os acessos (endereço, usuário) continuam na lista."
        confirmLabel="Destruir o cofre"
        pending={destroy.isPending}
        onCancel={() => setConfirmDestroy(false)}
        onConfirm={async () => {
          if (!orgId) return
          setError(null)
          try {
            await destroy.mutateAsync(orgId)
            vault.lock()
            onNotice('Cofre destruído.')
          } catch {
            setError('Não foi possível destruir o cofre.')
          } finally {
            setConfirmDestroy(false)
          }
        }}
      />
    </>
  )
}

function RekeyForm({ onDone }: { onDone: () => void }) {
  const { orgId } = useCurrentWorkspace()
  const vault = useVault()
  const rekey = useRekeyVault()
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RekeyValues>({ resolver: zodResolver(rekeySchema) })

  const submit = handleSubmit(async (v) => {
    const meta = vault.meta
    if (!orgId || !meta) return
    setError(null)
    try {
      const old = await deriveKeys(v.current, meta.salt, meta.iterations)
      const res = await rpcUnlock(orgId, old.proof)
      if (res.status !== 'ok' || !res.share) {
        setError(
          res.status === 'wrong'
            ? `Senha mestra atual incorreta. Restam ${res.attemptsLeft ?? 0} tentativas antes de o cofre ser destruído.`
            : res.status === 'locked'
              ? 'O cofre está bloqueado por erros seguidos. Tente de novo mais tarde.'
              : res.status === 'destroyed'
                ? 'Erros demais: o cofre foi destruído.'
                : 'Este cofre não abre mais.',
        )
        return
      }
      const dek = await unwrapDek(old.clientKey, res.share, meta.wrappedDek, meta.dekIv)
      const salt = randomBytes(16)
      const next = await deriveKeys(v.password, salt, KDF_ITERATIONS)
      const wrapped = await wrapDek(next.clientKey, res.share, dek)
      dek.fill(0)
      const status = await rekey.mutateAsync({
        orgId,
        oldProof: old.proof,
        newProof: next.proof,
        salt,
        iterations: KDF_ITERATIONS,
        wrappedDek: wrapped.data,
        dekIv: wrapped.iv,
      })
      if (status !== 'ok') {
        setError('Não foi possível trocar a senha mestra. Tente de novo.')
        return
      }
      onDone()
    } catch {
      setError('Não foi possível trocar a senha mestra. Tente de novo.')
    }
  })

  return (
    <Plate id="vault-rekey-h" title="Trocar a senha mestra">
      <form onSubmit={submit} noValidate className="max-w-xl space-y-4">
        <Field id="rk-current" label="Senha mestra atual" error={errors.current?.message}>
          <input id="rk-current" type="password" autoComplete="off" className={controlClass} {...register('current')} />
        </Field>
        <Field id="rk-new" label="Nova senha mestra" error={errors.password?.message}>
          <input id="rk-new" type="password" autoComplete="new-password" className={controlClass} {...register('password')} />
        </Field>
        <Field id="rk-confirm" label="Repita a nova senha mestra" error={errors.confirm?.message}>
          <input id="rk-confirm" type="password" autoComplete="new-password" className={controlClass} {...register('confirm')} />
        </Field>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Trocando…' : 'Trocar senha mestra'}
        </Button>
      </form>
    </Plate>
  )
}

import { useEffect, useId, useRef, useState } from 'react'
import { KeyRound, ShieldAlert } from 'lucide-react'
import { controlClass } from '@/components/form-styles'
import { Button } from '@/components/ui/button'
import type { VaultMeta } from './api'
import type { UnlockOutcome } from './vault-context'

const timeFmt = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })

function outcomeMessage(o: UnlockOutcome | null, maxAttempts: number): string | null {
  if (!o || o.status === 'ok') return null
  if (o.status === 'wrong') {
    const left = o.attemptsLeft ?? 0
    const lock = o.retryAt ? ` Novo bloqueio: até ${timeFmt.format(new Date(o.retryAt))}.` : ''
    if (left <= 1) return `Senha mestra incorreta. ÚLTIMA tentativa: errar de novo destrói o cofre.${lock}`
    return `Senha mestra incorreta. Restam ${left} de ${maxAttempts} tentativas.${lock}`
  }
  if (o.status === 'locked') return `Cofre bloqueado até ${o.retryAt ? timeFmt.format(new Date(o.retryAt)) : 'mais tarde'}.`
  if (o.status === 'destroyed') return 'Erros demais: o cofre foi destruído e o conteúdo se perdeu.'
  if (o.status === 'missing') return 'Este cofre não abre mais (a parte guardada no servidor não existe). Recrie-o em Configurações → Cofre.'
  return 'Não foi possível abrir o cofre agora. Tente de novo.'
}

/** Pede a senha mestra num <dialog> modal. A senha vai só para a derivação local da chave. */
export function UnlockDialog({
  open,
  meta,
  onUnlock,
  onClose,
}: {
  open: boolean
  meta: VaultMeta | null
  onUnlock: (password: string) => Promise<UnlockOutcome>
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const titleId = useId()
  const descId = useId()
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState<UnlockOutcome | null>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      input.current?.focus()
    }
    if (!open && dialog.open) dialog.close()
  }, [open])

  const max = meta?.maxAttempts ?? 5
  const lockedUntil = meta?.lockedUntil && new Date(meta.lockedUntil) > new Date() ? meta.lockedUntil : null
  const initialLeft = meta && meta.failedAttempts > 0 ? max - meta.failedAttempts : null
  const message =
    outcomeMessage(outcome, max) ??
    (lockedUntil
      ? `Cofre bloqueado até ${timeFmt.format(new Date(lockedUntil))}.`
      : initialLeft !== null
        ? `Há ${meta!.failedAttempts} erro(s) seguido(s) registrado(s). Restam ${initialLeft} tentativas antes de o cofre ser destruído.`
        : null)
  const finished = outcome?.status === 'destroyed' || outcome?.status === 'missing'

  const close = () => {
    setPw('')
    setOutcome(null)
    onClose()
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pw || busy) return
    setBusy(true)
    const result = await onUnlock(pw)
    setBusy(false)
    setPw('')
    if (result.status === 'ok') {
      setOutcome(null)
      return
    }
    setOutcome(result)
    input.current?.focus()
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={descId}
      onCancel={(e) => {
        e.preventDefault()
        if (!busy) close()
      }}
      onClick={(e) => {
        if (e.target === ref.current && !busy) close()
      }}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-xl border border-border bg-card p-0 text-card-foreground shadow-pop backdrop:bg-foreground/45"
    >
      <form onSubmit={submit} className="space-y-4 p-6" noValidate>
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-tone-info-bg text-primary">
            <KeyRound className="size-5" />
          </span>
          <div className="min-w-0 space-y-1">
            <h2 id={titleId} className="text-lg font-bold tracking-[-0.01em]">
              Destrancar o cofre
            </h2>
            <p id={descId} className="text-sm text-muted-foreground">
              Digite a senha mestra. Ela nunca sai deste aparelho. O cofre fecha sozinho depois de 5 minutos sem uso.
            </p>
          </div>
        </div>

        {!finished && (
          <div className="space-y-1.5">
            <label htmlFor={`${titleId}-pw`} className="text-sm font-medium">
              Senha mestra
            </label>
            <input
              id={`${titleId}-pw`}
              ref={input}
              type="password"
              autoComplete="off"
              className={controlClass}
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              disabled={busy || Boolean(lockedUntil)}
            />
          </div>
        )}

        {message && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-lg bg-tone-warning-bg px-3 py-2 text-sm font-medium text-tone-warning"
          >
            <ShieldAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {message}
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={close} disabled={busy}>
            {finished ? 'Fechar' : 'Cancelar'}
          </Button>
          {!finished && (
            <Button type="submit" disabled={busy || !pw || Boolean(lockedUntil)}>
              {busy ? 'Verificando…' : 'Destrancar'}
            </Button>
          )}
        </div>
      </form>
    </dialog>
  )
}

import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Field } from '@/components/form'
import { controlClass } from '@/components/form-styles'
import { Plate } from '@/components/Plate'
import { ErrorState, LoadingState, PageHeader, StatusBadge } from '@/components/states'
import { Button } from '@/components/ui/button'
import { useCurrentWorkspace } from '@/features/workspace/useCurrentWorkspace'
import { formatDateTime } from '@/lib/format'
import { useOutreachSettings, useSaveOutreachSettings } from './api'
import { ProspectingNav } from './ProspectingNav'
import {
  outreachSettingsDefaults,
  outreachSettingsPayload,
  outreachSettingsSchema,
  type OutreachSettingsValues,
} from './schema'

const stateLabel = { open: 'Conectado', connecting: 'Conectando', close: 'Desconectado' } as const

/** Limites, janela e remetente do envio, mais o botão de pausar tudo. Chaves de API NÃO ficam aqui (só no servidor). */
export function OutreachSettingsPage() {
  const { orgId, canWrite } = useCurrentWorkspace()
  const q = useOutreachSettings(Boolean(orgId))
  const save = useSaveOutreachSettings(orgId)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const s = q.data

  const initial: OutreachSettingsValues = s
    ? {
        email_from: s.email_from ?? '',
        email_reply_to: s.email_reply_to ?? '',
        email_daily_limit: String(s.email_daily_limit),
        whatsapp_daily_limit: String(s.whatsapp_daily_limit),
        window_start: s.window_start.slice(0, 5),
        window_end: s.window_end.slice(0, 5),
        weekdays_only: s.weekdays_only,
        timezone: s.timezone,
      }
    : outreachSettingsDefaults

  const togglePause = async () => {
    setError(null)
    setMessage(null)
    try {
      await save.mutateAsync({ paused: !(s?.paused ?? false) })
      setMessage(s?.paused ? 'Envios retomados.' : 'Todos os envios pausados.')
    } catch {
      setError('Não foi possível alterar a pausa.')
    }
  }

  return (
    <>
      <PageHeader title="Configurações" description="Remetente, limites e janela de envio. Nada sai fora da janela, dos dias úteis e do limite diário." />
      <ProspectingNav />
      {q.isPending && <LoadingState />}
      {q.isError && <ErrorState message="Não foi possível carregar as configurações." onRetry={() => q.refetch()} />}
      {q.isSuccess && (
        <div className="max-w-3xl space-y-6">
          <Plate id="pause-h" title="Envios" action={<StatusBadge tone={s?.paused ? 'warning' : 'success'}>{s?.paused ? 'Pausados' : 'Ativos'}</StatusBadge>}>
            <div className="max-w-xl space-y-3">
              <p className="text-sm text-muted-foreground">
                O envio roda a cada minuto e só leva mensagens <strong className="text-foreground">aprovadas</strong>. Em dúvida, pause tudo: as aprovadas ficam esperando.
              </p>
              {canWrite && (
                <Button variant={s?.paused ? 'default' : 'outline'} disabled={save.isPending} onClick={togglePause}>
                  {s?.paused ? 'Retomar envios' : 'Pausar tudo'}
                </Button>
              )}
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

          <SettingsForm key={s?.updated_at ?? 'novo'} initial={initial} readOnly={!canWrite} onSave={async (values) => {
            setError(null)
            setMessage(null)
            try {
              await save.mutateAsync(outreachSettingsPayload(values))
              setMessage('Configurações salvas.')
            } catch {
              setError('Não foi possível salvar as configurações.')
            }
          }} />

          <Plate id="wa-h" title="WhatsApp" action={s?.whatsapp_state ? <StatusBadge tone={s.whatsapp_state === 'open' ? 'success' : 'warning'}>{stateLabel[s.whatsapp_state as keyof typeof stateLabel]}</StatusBadge> : undefined}>
            <p className="text-sm text-muted-foreground">
              {s?.whatsapp_state
                ? `Estado da conexão atualizado em ${s.whatsapp_state_at ? formatDateTime(s.whatsapp_state_at) : '—'}. `
                : 'Ainda sem informação de conexão (o Evolution avisa por webhook). '}
              O WhatsApp só envia com a conexão aberta, no máximo uma conversa nova por vez, com intervalo aleatório de 60 a 240 segundos, e só para leads mornos e quentes.
            </p>
          </Plate>
        </div>
      )}
    </>
  )
}

function SettingsForm({ initial, readOnly, onSave }: { initial: OutreachSettingsValues; readOnly: boolean; onSave: (v: OutreachSettingsValues) => Promise<void> }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<OutreachSettingsValues>({ resolver: zodResolver(outreachSettingsSchema), defaultValues: initial })
  const err = (k: keyof OutreachSettingsValues) => errors[k]?.message
  return (
    <Plate id="settings-h" title="Remetente, limites e janela">
      <form onSubmit={handleSubmit(onSave)} noValidate className="max-w-xl space-y-4">
        <fieldset disabled={readOnly || isSubmitting} className="space-y-4">
          <Field id="email_from" label="E-mail de envio" error={err('email_from')} hint="Do domínio verificado no Resend. Ex.: Seu Nome <contato@seudominio.com.br>">
            <input id="email_from" autoComplete="off" className={controlClass} aria-invalid={errors.email_from ? true : undefined} {...register('email_from')} />
          </Field>
          <Field id="email_reply_to" label="Responder para" error={err('email_reply_to')} hint="Opcional. Onde as respostas chegam (o e-mail ainda é registrado à mão em Respostas).">
            <input id="email_reply_to" autoComplete="off" className={controlClass} {...register('email_reply_to')} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="email_daily_limit" label="E-mails por dia" error={err('email_daily_limit')} hint="Plano grátis do Resend: até 100/dia.">
              <input id="email_daily_limit" inputMode="numeric" className={controlClass} {...register('email_daily_limit')} />
            </Field>
            <Field id="whatsapp_daily_limit" label="Conversas novas no WhatsApp por dia" error={err('whatsapp_daily_limit')} hint="Número da empresa: comece com poucas.">
              <input id="whatsapp_daily_limit" inputMode="numeric" className={controlClass} {...register('whatsapp_daily_limit')} />
            </Field>
            <Field id="window_start" label="Janela: início" error={err('window_start')}>
              <input id="window_start" className={controlClass} placeholder="09:00" {...register('window_start')} />
            </Field>
            <Field id="window_end" label="Janela: fim" error={err('window_end')}>
              <input id="window_end" className={controlClass} placeholder="18:00" {...register('window_end')} />
            </Field>
          </div>
          <Field id="timezone" label="Fuso da janela" error={err('timezone')} hint="Ex.: America/Sao_Paulo">
            <input id="timezone" className={controlClass} {...register('timezone')} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4" {...register('weekdays_only')} />
            Só em dias úteis (segunda a sexta)
          </label>
        </fieldset>
        {!readOnly && (
          <Button type="submit" className="h-11" disabled={isSubmitting}>
            {isSubmitting ? 'Salvando…' : 'Salvar'}
          </Button>
        )}
      </form>
    </Plate>
  )
}

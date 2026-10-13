import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/form'
import { controlClass } from '@/components/form-styles'
import { PageHeader } from '@/components/states'
import { useAuth } from '@/features/auth/auth-context'
import { activeTimezone, browserTimezone } from '@/lib/format'
import { useSaveTimezone } from './api'

const SAVED_KEY = 'projecthub:timezone-saved'

/** A troca de fuso remonta a árvore; o aviso de sucesso sobrevive via sessionStorage (uso único). */
function takeSavedNotice() {
  try {
    const v = sessionStorage.getItem(SAVED_KEY)
    sessionStorage.removeItem(SAVED_KEY)
    return v
  } catch {
    return null
  }
}

function supportedZones(current: string) {
  const zones = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : []
  return [...new Set(['UTC', current, ...zones])].sort((a, b) => a.localeCompare(b))
}

export function SettingsPage() {
  const { session } = useAuth()
  const save = useSaveTimezone(session?.user.id)
  const current = activeTimezone()
  const zones = useMemo(() => supportedZones(current), [current])
  const [value, setValue] = useState(current)
  const [message, setMessage] = useState<string | null>(() => takeSavedNotice())
  const [error, setError] = useState<string | null>(null)
  const browser = browserTimezone()

  const preview = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: value })

  const submit = async () => {
    setMessage(null)
    setError(null)
    try {
      try {
        sessionStorage.setItem(SAVED_KEY, 'Fuso salvo. Datas e horários foram atualizados.')
      } catch {
        // sem sessionStorage: o aviso simplesmente não aparece
      }
      await save.mutateAsync(value)
      setMessage('Fuso salvo. Datas e horários foram atualizados.')
    } catch {
      takeSavedNotice()
      setError('Não foi possível salvar o fuso.')
    }
  }

  return (
    <>
      <PageHeader title="Configurações" />
      <section aria-labelledby="tz-h" className="max-w-xl space-y-3">
        <h2 id="tz-h" className="text-lg font-semibold">
          Fuso de trabalho
        </h2>
        <p className="text-sm text-muted-foreground">
          Define o que é &quot;hoje&quot;, o horário dos eventos que você cria e como datas e horas aparecem.
          O fuso do navegador é {browser}.
        </p>
        <Field id="timezone" label="Fuso" hint={`Agora, neste fuso: ${preview}`}>
          <select id="timezone" className={controlClass} value={value} onChange={(e) => setValue(e.target.value)}>
            {zones.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button disabled={save.isPending || value === current} onClick={submit}>
            Salvar fuso
          </Button>
          {value !== browser && (
            <Button variant="outline" onClick={() => setValue(browser)}>
              Usar o do navegador
            </Button>
          )}
        </div>
        {message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </section>
    </>
  )
}

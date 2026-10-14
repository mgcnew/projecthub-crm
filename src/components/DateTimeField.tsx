import { CalendarDays, Clock } from 'lucide-react'
import { useCallback, useRef, useState, type Ref } from 'react'
import { Calendar } from '@/components/datetime/Calendar'
import { PickerPopover } from '@/components/datetime/PickerPopover'
import { TimeList } from '@/components/datetime/TimeList'
import { controlClass } from '@/components/form-styles'
import {
  cleanTime,
  formatDate,
  formatDateTime,
  maskDate,
  maskDateTime,
  parseDate,
  parseDateTime,
  parseTime,
} from '@/lib/dateInput'
import { todayISO } from '@/lib/format'
import { cn } from '@/lib/utils'

export type PickerMode = 'date' | 'datetime' | 'time'

export type PickerFieldProps = {
  id: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  name?: string
  invalid?: boolean
  disabled?: boolean
  /** Mostra "Limpar" no seletor (padrão: sim). */
  clearable?: boolean
  inputRef?: Ref<HTMLInputElement>
  'aria-label'?: string
  className?: string
}

const config = {
  date: {
    placeholder: 'dd/mm/aaaa',
    parse: parseDate,
    format: formatDate,
    mask: maskDate,
    invalidText: 'Data inválida. Use dd/mm/aaaa.',
    openLabel: 'Abrir calendário',
    popoverLabel: 'Escolher data',
    Icon: CalendarDays,
  },
  datetime: {
    placeholder: 'dd/mm/aaaa hh:mm',
    parse: parseDateTime,
    format: formatDateTime,
    mask: maskDateTime,
    invalidText: 'Data e hora inválidas. Use dd/mm/aaaa hh:mm.',
    openLabel: 'Abrir calendário',
    popoverLabel: 'Escolher data e hora',
    Icon: CalendarDays,
  },
  time: {
    placeholder: 'hh:mm',
    parse: parseTime,
    format: (v: string) => v,
    mask: cleanTime,
    invalidText: 'Hora inválida. Use hh:mm.',
    openLabel: 'Abrir horários',
    popoverLabel: 'Escolher horário',
    Icon: Clock,
  },
} as const

function PickerField({
  mode,
  id,
  value,
  onChange,
  onBlur,
  name,
  invalid,
  disabled,
  clearable = true,
  inputRef,
  'aria-label': ariaLabel,
  className,
}: PickerFieldProps & { mode: PickerMode }) {
  const cfg = config[mode]
  const wrap = useRef<HTMLDivElement>(null)
  const toggle = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [text, setText] = useState(cfg.format(value))
  const [seen, setSeen] = useState(value)
  const [bad, setBad] = useState(false)

  // O valor mudou por fora (calendário, redefinição do formulário): o texto passa a espelhá-lo, mas um
  // texto ainda incompleto do usuário (valor vazio) não é sobrescrito.
  if (value !== seen) {
    setSeen(value)
    const typed = cfg.parse(text) ?? ''
    if (typed !== value) {
      setText(cfg.format(value))
      setBad(false)
    }
  }

  const close = useCallback((reason: 'escape' | 'outside' | 'blur') => {
    setOpen(false)
    if (reason === 'escape') toggle.current?.focus()
  }, [])
  const commit = (next: string) => {
    onChange(next)
  }

  const onType = (raw: string) => {
    const masked = cfg.mask(raw)
    setText(masked)
    const parsed = cfg.parse(masked)
    setBad(false)
    commit(parsed ?? '')
  }

  const onBlurInput = () => {
    const parsed = cfg.parse(text)
    if (parsed) {
      setText(cfg.format(parsed))
      setBad(false)
    } else {
      setBad(text.trim() !== '')
    }
    onBlur?.()
  }

  const dateIso = mode === 'time' ? '' : value.slice(0, 10)
  const timeStr = mode === 'datetime' ? value.slice(11, 16) : mode === 'time' ? value : ''
  const errorId = `${id}-format`
  const showInvalid = invalid || bad
  const describedBy = bad ? errorId : invalid ? `${id}-error` : undefined
  const today = todayISO()

  return (
    <div className={cn('space-y-1', className)}>
      <div ref={wrap} className="relative">
        <input
          ref={inputRef}
          id={id}
          name={name}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          spellCheck={false}
          placeholder={cfg.placeholder}
          disabled={disabled}
          aria-label={ariaLabel}
          aria-invalid={showInvalid ? true : undefined}
          aria-describedby={describedBy}
          value={text}
          onChange={(e) => onType(e.target.value)}
          onBlur={onBlurInput}
          className={cn(controlClass, 'pr-12 tabular-nums')}
        />
        <button
          ref={toggle}
          type="button"
          disabled={disabled}
          aria-label={cfg.openLabel}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="absolute top-0 right-0 flex h-11 w-11 items-center justify-center rounded-sm text-foreground hover:bg-muted focus-visible:outline-[3px] focus-visible:-outline-offset-2 focus-visible:outline-ring/60 disabled:opacity-60"
        >
          <cfg.Icon aria-hidden="true" className="size-5" />
        </button>

        <PickerPopover
          open={open}
          anchor={wrap}
          label={cfg.popoverLabel}
          onClose={close}
          className={mode === 'datetime' ? 'w-[min(27rem,calc(100vw-1rem))]' : mode === 'time' ? 'w-[min(11rem,calc(100vw-1rem))]' : undefined}
        >
          {mode === 'time' ? (
            <TimeList
              autoFocus
              value={timeStr}
              onPick={(hm) => {
                commit(hm)
                setText(hm)
                setBad(false)
                setOpen(false)
                toggle.current?.focus()
              }}
            />
          ) : (
            <div className={cn(mode === 'datetime' && 'grid gap-3 min-[420px]:grid-cols-[1fr_6.5rem]')}>
              <div>
                <Calendar
                  selected={dateIso}
                  today={today}
                  onPick={(iso) => {
                    if (mode === 'date') {
                      commit(iso)
                      setText(formatDate(iso))
                      setBad(false)
                      setOpen(false)
                      toggle.current?.focus()
                    } else {
                      const next = `${iso}T${timeStr || '09:00'}`
                      commit(next)
                      setText(formatDateTime(next))
                      setBad(false)
                    }
                  }}
                />
              </div>
              {mode === 'datetime' && (
                <TimeList
                  value={timeStr}
                  onPick={(hm) => {
                    const next = `${dateIso || today}T${hm}`
                    commit(next)
                    setText(formatDateTime(next))
                    setBad(false)
                    setOpen(false)
                    toggle.current?.focus()
                  }}
                />
              )}
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
            {mode !== 'time' ? (
              <button
                type="button"
                className="min-h-10 rounded-sm px-2 text-sm font-semibold underline pointer-coarse:min-h-11"
                onClick={() => {
                  const next = mode === 'date' ? today : `${today}T${timeStr || '09:00'}`
                  commit(next)
                  setText(mode === 'date' ? formatDate(next) : formatDateTime(next))
                  setBad(false)
                  if (mode === 'date') {
                    setOpen(false)
                    toggle.current?.focus()
                  }
                }}
              >
                Hoje
              </button>
            ) : (
              <span />
            )}
            <span className="flex gap-1">
              {clearable && (
                <button
                  type="button"
                  className="min-h-10 rounded-sm px-2 text-sm font-semibold underline pointer-coarse:min-h-11"
                  onClick={() => {
                    commit('')
                    setText('')
                    setBad(false)
                    setOpen(false)
                    toggle.current?.focus()
                  }}
                >
                  Limpar
                </button>
              )}
              {mode === 'datetime' && (
                <button
                  type="button"
                  className="min-h-10 rounded-sm border border-foreground bg-foreground px-3 text-sm font-semibold text-card pointer-coarse:min-h-11"
                  onClick={() => {
                    setOpen(false)
                    toggle.current?.focus()
                  }}
                >
                  Concluir
                </button>
              )}
            </span>
          </div>
        </PickerPopover>
      </div>
      {bad && (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {cfg.invalidText}
        </p>
      )}
    </div>
  )
}

/** Data (`YYYY-MM-DD`) com calendário no tema do sistema. */
export function DateField(props: PickerFieldProps) {
  return <PickerField mode="date" {...props} />
}

/** Data e hora locais (`YYYY-MM-DDTHH:mm`, o mesmo formato do datetime-local) com calendário e horários. */
export function DateTimeField(props: PickerFieldProps) {
  return <PickerField mode="datetime" {...props} />
}

/** Horário (`HH:mm`) com lista de 15 em 15 minutos e digitação livre. */
export function TimeField(props: PickerFieldProps) {
  return <PickerField mode="time" {...props} />
}

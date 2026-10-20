import { Download, Upload } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Field } from '@/components/form'
import { controlClass } from '@/components/form-styles'
import { EmptyState, PageHeader, StatusBadge } from '@/components/states'
import { Button } from '@/components/ui/button'
import { useCurrentWorkspace } from '@/features/workspace/useCurrentWorkspace'
import { decodeCsv, parseCsv } from '@/lib/csv'
import { formatDateTime } from '@/lib/format'
import { fetchExisting, useLeadImports, useRunImport, type ImportResult } from './api'
import {
  LEAD_FIELDS,
  MAX_ROWS,
  normalizeRow,
  planImport,
  suggestMapping,
  type DuplicateMode,
  type ImportPlan,
  type LeadField,
  type Mapping,
} from './plan'

const MAX_BYTES = 5 * 1024 * 1024
const TEMPLATE = 'Empresa;Contato;Telefone;E-mail;Site;Endereço;Cidade;UF;Segmento;Observações\r\n'

type Sheet = { fileName: string; headers: string[]; rows: string[][] }

function IssueList({ title, items }: { title: string; items: { line: number; reason: string }[] }) {
  if (items.length === 0) return null
  return (
    <details className="plate p-3">
      <summary className="cursor-pointer text-sm font-semibold">
        {title} ({items.length})
      </summary>
      <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto text-sm">
        {items.slice(0, 200).map((i) => (
          <li key={`${i.line}-${i.reason}`}>
            <span className="font-semibold tabular-nums">Linha {i.line}:</span> {i.reason}
          </li>
        ))}
      </ul>
    </details>
  )
}

export function ImportPage() {
  const { orgId, canWrite } = useCurrentWorkspace()
  const run = useRunImport(orgId)
  const history = useLeadImports(Boolean(orgId))
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const [mapping, setMapping] = useState<Mapping>([])
  const [mode, setMode] = useState<DuplicateMode>('skip')
  const [source, setSource] = useState('')
  const [fileError, setFileError] = useState<string | null>(null)
  const [plan, setPlan] = useState<ImportPlan | null>(null)
  const [reviewing, setReviewing] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [runError, setRunError] = useState<string | null>(null)

  const templateHref = useMemo(() => URL.createObjectURL(new Blob(['\uFEFF' + TEMPLATE], { type: 'text/csv' })), [])

  if (!canWrite) return <p role="alert">Você não tem permissão para importar leads.</p>

  const reset = () => {
    setSheet(null)
    setMapping([])
    setPlan(null)
    setResult(null)
    setRunError(null)
    setFileError(null)
    setSource('')
  }

  const onFile = async (file: File | undefined) => {
    reset()
    if (!file) return
    if (!/\.csv$/i.test(file.name)) return setFileError('Envie um arquivo .csv (no Excel: Salvar como → CSV).')
    if (file.size > MAX_BYTES) return setFileError('Arquivo maior que 5 MB. Divida a planilha em partes.')
    const all = parseCsv(decodeCsv(await file.arrayBuffer()))
    if (all.length < 2) return setFileError('A planilha precisa de uma linha de cabeçalho e pelo menos um lead.')
    const [headers, ...rows] = all
    if (rows.length > MAX_ROWS) return setFileError(`Até ${MAX_ROWS} linhas por arquivo. Esta tem ${rows.length}.`)
    setSheet({ fileName: file.name, headers, rows })
    setMapping(suggestMapping(headers))
    setSource(file.name.replace(/\.csv$/i, ''))
  }

  const hasCompany = mapping.includes('company_name')
  const sourceOk = source.trim().length > 0

  const review = async () => {
    if (!sheet) return
    setReviewing(true)
    setRunError(null)
    try {
      const emails: string[] = []
      const phones: string[] = []
      for (const cells of sheet.rows) {
        const values: Partial<Record<LeadField, string>> = {}
        mapping.forEach((f, i) => {
          if (f) values[f] = cells[i]
        })
        const r = normalizeRow(values)
        if ('lead' in r) {
          if (r.lead.email) emails.push(r.lead.email)
          if (r.lead.phone) phones.push(r.lead.phone)
        }
      }
      const existing = await fetchExisting(emails, phones)
      setPlan(planImport(sheet.rows, mapping, existing, mode))
    } catch {
      setRunError('Não foi possível conferir os leads já cadastrados. Tente novamente.')
    } finally {
      setReviewing(false)
    }
  }

  const doImport = async () => {
    if (!sheet || !plan) return
    setRunError(null)
    try {
      setResult(await run.mutateAsync({ plan, source: source.trim(), fileName: sheet.fileName, total: sheet.rows.length }))
    } catch {
      setRunError('A importação falhou. Nada foi registrado no histórico; confira a lista de leads antes de tentar de novo.')
    }
  }

  const sample = (col: number) => sheet?.rows.find((r) => (r[col] ?? '') !== '')?.[col] ?? ''

  return (
    <>
      <PageHeader
        title="Importar leads"
        description="Planilha CSV com empresa, telefone, e-mail, site e endereço. Os leads entram como frios."
        actions={
          <Button asChild variant="outline">
            <Link to="/app/prospeccao">Voltar para leads</Link>
          </Button>
        }
      />

      {result ? (
        <section aria-labelledby="result-h" className="space-y-3">
          <h2 id="result-h" className="section-title">
            Importação concluída
          </h2>
          <dl className="grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-4">
            {[
              ['Novos', result.created],
              ['Completados', result.updated],
              ['Ignorados', result.skipped],
              ['Com erro', result.errors.length],
            ].map(([label, n]) => (
              <div key={label} className="bg-card px-4 py-3">
                <dt className="section-title">{label}</dt>
                <dd className="mt-1 text-xl font-bold tabular-nums">{n}</dd>
              </div>
            ))}
          </dl>
          <IssueList title="Linhas com erro" items={result.errors} />
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/app/prospeccao">Ver leads</Link>
            </Button>
            <Button variant="outline" onClick={reset}>
              Importar outra planilha
            </Button>
          </div>
        </section>
      ) : (
        <div className="max-w-3xl space-y-6">
          <section aria-labelledby="file-h" className="space-y-3">
            <h2 id="file-h" className="section-title">
              1. Arquivo
            </h2>
            <Field id="csv-file" label="Planilha (CSV)" error={fileError ?? undefined} hint="Até 5 MB e 5.000 linhas. Separador vírgula ou ponto e vírgula.">
              <input
                id="csv-file"
                type="file"
                accept=".csv,text/csv"
                aria-invalid={fileError ? true : undefined}
                className="block w-full text-sm file:mr-3 file:min-h-11 file:rounded-sm file:border file:border-input file:bg-card file:px-3 file:font-semibold hover:file:bg-muted"
                onChange={(e) => void onFile(e.target.files?.[0])}
              />
            </Field>
            <a
              href={templateHref}
              download="modelo-leads.csv"
              className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary-strong underline"
            >
              <Download aria-hidden="true" className="size-4" />
              Baixar modelo de planilha
            </a>
          </section>

          {sheet && (
            <>
              <section aria-labelledby="map-h" className="space-y-3">
                <h2 id="map-h" className="section-title">
                  2. Colunas · {sheet.rows.length} linha{sheet.rows.length === 1 ? '' : 's'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Diga o que cada coluna é. As colunas marcadas como "Ignorar" não são lidas.
                </p>
                <ul className="plate divide-y divide-border">
                  {sheet.headers.map((h, i) => (
                    <li key={`${h}-${i}`} className="grid gap-2 px-4 py-3 sm:grid-cols-[1fr_14rem] sm:items-center">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{h || `Coluna ${i + 1}`}</p>
                        <p className="truncate text-sm text-muted-foreground">{sample(i) || 'sem exemplo'}</p>
                      </div>
                      <select
                        aria-label={`Coluna "${h || `Coluna ${i + 1}`}"`}
                        className={controlClass}
                        value={mapping[i] ?? ''}
                        onChange={(e) => {
                          const next = [...mapping]
                          const field = e.target.value as LeadField | ''
                          // Um campo por coluna: escolher de novo um campo já usado libera a coluna anterior.
                          if (field) next.forEach((f, j) => f === field && (next[j] = ''))
                          next[i] = field
                          setMapping(next)
                          setPlan(null)
                        }}
                      >
                        <option value="">Ignorar</option>
                        {Object.entries(LEAD_FIELDS).map(([v, l]) => (
                          <option key={v} value={v}>
                            {l}
                          </option>
                        ))}
                      </select>
                    </li>
                  ))}
                </ul>
                {!hasCompany && (
                  <p role="alert" className="text-sm text-destructive">
                    Escolha qual coluna é a empresa.
                  </p>
                )}
              </section>

              <section aria-labelledby="opts-h" className="space-y-4">
                <h2 id="opts-h" className="section-title">
                  3. Origem e duplicados
                </h2>
                <Field id="import-source" label="Origem desta lista *" hint="Fica registrada em cada lead (LGPD): de onde veio o contato.">
                  <input
                    id="import-source"
                    autoComplete="off"
                    className={controlClass}
                    value={source}
                    aria-invalid={sourceOk ? undefined : true}
                    onChange={(e) => {
                      setSource(e.target.value)
                      setPlan(null)
                    }}
                  />
                </Field>
                <fieldset className="space-y-2">
                  <legend className="text-sm font-semibold">Quando o e-mail ou o telefone já existir</legend>
                  {(
                    [
                      ['skip', 'Ignorar a linha', 'O lead cadastrado fica como está.'],
                      ['fill', 'Completar o lead cadastrado', 'Preenche só os campos que estão vazios nele.'],
                    ] as const
                  ).map(([v, label, hint]) => (
                    <label key={v} className="flex min-h-11 items-start gap-3 text-sm">
                      <input
                        type="radio"
                        name="dup-mode"
                        className="mt-1 size-5"
                        checked={mode === v}
                        onChange={() => {
                          setMode(v)
                          setPlan(null)
                        }}
                      />
                      <span>
                        <span className="block font-semibold">{label}</span>
                        <span className="text-muted-foreground">{hint}</span>
                      </span>
                    </label>
                  ))}
                </fieldset>
                <Button variant="outline" disabled={!hasCompany || !sourceOk || reviewing} onClick={() => void review()}>
                  {reviewing ? 'Conferindo…' : 'Revisar importação'}
                </Button>
              </section>

              {plan && (
                <section aria-labelledby="review-h" className="space-y-3">
                  <h2 id="review-h" className="section-title">
                    4. Revisão
                  </h2>
                  <p role="status" className="text-sm font-medium">
                    {plan.inserts.length} novo{plan.inserts.length === 1 ? '' : 's'} · {plan.updates.length} a completar ·{' '}
                    {plan.skipped.length} ignorado{plan.skipped.length === 1 ? '' : 's'} · {plan.errors.length} com erro
                  </p>
                  <IssueList title="Linhas com erro" items={plan.errors} />
                  <IssueList title="Linhas ignoradas" items={plan.skipped} />
                  <Button disabled={plan.inserts.length + plan.updates.length === 0 || run.isPending} onClick={() => void doImport()}>
                    <Upload aria-hidden="true" />
                    {run.isPending ? 'Importando…' : `Importar ${plan.inserts.length + plan.updates.length} lead${plan.inserts.length + plan.updates.length === 1 ? '' : 's'}`}
                  </Button>
                </section>
              )}
            </>
          )}
          {runError && (
            <p role="alert" className="text-sm text-destructive">
              {runError}
            </p>
          )}
        </div>
      )}

      <section aria-labelledby="history-h" className="space-y-3">
        <h2 id="history-h" className="section-title">
          Últimas importações
        </h2>
        {history.isSuccess && history.data.length === 0 && (
          <EmptyState title="Nenhuma importação ainda" description="O histórico mostra quantos leads entraram em cada planilha." />
        )}
        {(history.data?.length ?? 0) > 0 && (
          <ul className="plate divide-y divide-border">
            {history.data!.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 sm:px-5">
                <span className="min-w-0">
                  <span className="block font-semibold">{h.file_name}</span>
                  <span className="block text-sm text-muted-foreground">
                    {h.source} · {formatDateTime(h.created_at)}
                  </span>
                </span>
                <span className="flex flex-wrap gap-2 text-sm tabular-nums">
                  <StatusBadge>{h.created} novos</StatusBadge>
                  {h.updated > 0 && <StatusBadge>{h.updated} completados</StatusBadge>}
                  {h.skipped > 0 && <StatusBadge>{h.skipped} ignorados</StatusBadge>}
                  {Array.isArray(h.errors) && h.errors.length > 0 && <StatusBadge tone="info">{h.errors.length} com erro</StatusBadge>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

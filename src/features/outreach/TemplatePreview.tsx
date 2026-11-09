import { useMemo, useState } from 'react'
import { controlClass } from '@/components/form-styles'
import { lintMessage } from './lint'
import { renderMessage, type RenderLead, type RenderProduct } from './render'
import { splitLines, type Channel } from './schema'

const SAMPLE: RenderLead = { id: 'exemplo', company_name: 'Padaria Sol', contact_name: 'Maria Souza', hook: 'que vocês fazem entrega no bairro' }

export type PreviewLead = RenderLead & { product_id?: string | null }

/**
 * Pré-visualização com um lead real (ou um lead de exemplo): mostra o texto que aquele lead receberia,
 * com os avisos do verificador de estilo. O mesmo lead sempre vê a mesma variação.
 */
export function TemplatePreview({
  templateId,
  channel,
  step,
  subject,
  body,
  openings,
  closings,
  leads,
  product,
}: {
  templateId: string
  channel: Channel
  step: number
  subject: string
  body: string
  openings: string
  closings: string
  leads: PreviewLead[]
  product: RenderProduct
}) {
  const [leadId, setLeadId] = useState('')
  const lead = leads.find((l) => l.id === leadId) ?? leads[0] ?? SAMPLE
  const rendered = useMemo(
    () =>
      renderMessage({
        template: { id: templateId, step, subject: channel === 'email' ? subject : null, body, openings: splitLines(openings), closings: splitLines(closings) },
        lead,
        product,
      }),
    [templateId, step, channel, subject, body, openings, closings, lead, product],
  )
  const warnings = lintMessage({ channel, step, text: rendered.body, subject: rendered.subject, missing: rendered.missing, unknown: rendered.unknown })

  return (
    <section aria-labelledby="preview-h" className="space-y-3 rounded-lg border border-border bg-muted/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="preview-h" className="text-sm font-bold">
          Pré-visualização
        </h3>
        <select aria-label="Lead para a pré-visualização" className={controlClass + ' max-w-64'} value={lead.id} onChange={(e) => setLeadId(e.target.value)}>
          {leads.length === 0 && <option value="exemplo">Lead de exemplo (Padaria Sol)</option>}
          {leads.map((l) => (
            <option key={l.id} value={l.id}>
              {l.company_name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2 rounded-md bg-card p-3 text-sm shadow-card">
        {rendered.subject !== null && (
          <p>
            <span className="text-muted-foreground">Assunto: </span>
            <strong>{rendered.subject || '—'}</strong>
          </p>
        )}
        <p className="whitespace-pre-wrap" data-testid="preview-body">
          {rendered.body || '—'}
        </p>
      </div>
      {warnings.length === 0 ? (
        <p role="status" className="text-sm text-tone-success">
          Sem avisos de estilo para este lead.
        </p>
      ) : (
        <ul aria-label="Avisos de estilo" className="space-y-1.5">
          {warnings.map((w, i) => (
            <li key={`${w.code}-${i}`} className="rounded-md bg-tone-warning-bg px-3 py-1.5 text-sm text-tone-warning">
              {w.message}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

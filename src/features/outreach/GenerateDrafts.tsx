import { useMemo, useState } from 'react'
import { Field } from '@/components/form'
import { controlClass } from '@/components/form-styles'
import { Plate } from '@/components/Plate'
import { RowCheckbox } from '@/components/RowCheckbox'
import { Button } from '@/components/ui/button'
import { useCurrentWorkspace } from '@/features/workspace/useCurrentWorkspace'
import { useCreateDrafts, useProductOptions, useQueueLeads, useQueuedLeadIds, useSuppressedValues, useTemplate, useTemplates } from './api'
import { placeholdersIn, renderMessage } from './render'
import { skipLabels, splitEligible, type QueueLead, type SkipReason } from './queue'
import type { Channel } from './schema'

/**
 * Gera rascunhos de um modelo para os leads elegíveis. Nada é enviado: os rascunhos vão para a fila,
 * onde são revisados, editados e aprovados (D129).
 */
export function GenerateDrafts({ onClose }: { onClose: () => void }) {
  const { orgId } = useCurrentWorkspace()
  const templates = useTemplates({ channel: '', step: '', status: 'active' }, true)
  const [templateId, setTemplateId] = useState('')
  const template = useTemplate(templateId || undefined)
  const leads = useQueueLeads(true)
  const suppressed = useSuppressedValues(true)
  const queued = useQueuedLeadIds(templateId, true)
  const products = useProductOptions(true)
  const create = useCreateDrafts(orgId)
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const t = template.data
  const split = useMemo(() => {
    if (!t || !leads.data || !suppressed.data || !queued.data) return null
    return splitEligible({
      template: { channel: t.channel as Channel, temperature: t.temperature },
      leads: leads.data as QueueLead[],
      suppressed: suppressed.data,
      queued: queued.data,
    })
  }, [t, leads.data, suppressed.data, queued.data])

  const usesHook = t ? placeholdersIn(`${t.subject ?? ''}\n${t.body}\n${t.openings.join('\n')}\n${t.closings.join('\n')}`).includes('gancho') : false
  const chosen = split?.eligible.filter((l) => !excluded.has(l.id)) ?? []

  const generate = async () => {
    if (!t || chosen.length === 0) return
    setError(null)
    setResult(null)
    const drafts = chosen.map((lead) => {
      const productId = t.product_id ?? lead.product_id
      const p = products.data?.find((x) => x.id === productId) ?? null
      const r = renderMessage({
        template: { id: t.id, step: t.step, subject: t.subject, body: t.body, openings: t.openings, closings: t.closings },
        lead,
        product: p ? { name: p.name, value_proposition: p.value_proposition, demo_url: p.demo_url } : null,
      })
      return { leadId: lead.id, channel: t.channel as Channel, subject: r.subject, body: r.body }
    })
    try {
      const res = await create.mutateAsync({ templateId: t.id, drafts })
      setExcluded(new Set())
      setResult(
        `${res.created} rascunho${res.created === 1 ? '' : 's'} criado${res.created === 1 ? '' : 's'}${res.blocked ? `; ${res.blocked} barrado${res.blocked === 1 ? '' : 's'} pelo banco (supressão ou regra do canal)` : ''}. Revise e aprove na fila.`,
      )
    } catch {
      setError('Não foi possível gerar os rascunhos. Tente de novo.')
    }
  }

  return (
    <Plate
      id="gen-h"
      title="Gerar rascunhos"
      action={
        <Button variant="ghost" size="sm" onClick={onClose}>
          Fechar
        </Button>
      }
    >
      <div className="space-y-4">
        <Field id="gen-template" label="Modelo" hint="Os rascunhos usam o texto do modelo, com a variação própria de cada lead. Nada é enviado.">
          <select
            id="gen-template"
            className={controlClass}
            value={templateId}
            onChange={(e) => {
              setTemplateId(e.target.value)
              setExcluded(new Set())
              setResult(null)
            }}
          >
            <option value="">Escolha um modelo…</option>
            {(templates.data ?? []).map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} · {m.channel === 'email' ? 'E-mail' : 'WhatsApp'} · passo {m.step}
              </option>
            ))}
          </select>
        </Field>

        {templateId && !split && <p className="text-sm text-muted-foreground">Carregando leads…</p>}
        {split && (
          <>
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">{split.eligible.length}</strong> lead{split.eligible.length === 1 ? '' : 's'} pode{split.eligible.length === 1 ? '' : 'm'} receber este modelo
              {split.skipped.size > 0 && (
                <>
                  . De fora:{' '}
                  {[...split.skipped].map(([reason, n]) => `${n} ${skipLabels[reason as SkipReason]}`).join('; ')}
                </>
              )}
              .
            </p>
            {split.eligible.length > 0 && (
              <ul aria-label="Leads elegíveis" className="max-h-72 divide-y divide-border overflow-y-auto rounded-lg border border-border">
                {split.eligible.map((l) => (
                  <li key={l.id} className="flex items-center gap-2 px-2">
                    <RowCheckbox
                      label={`Incluir ${l.company_name}`}
                      checked={!excluded.has(l.id)}
                      onChange={() =>
                        setExcluded((prev) => {
                          const next = new Set(prev)
                          if (next.has(l.id)) next.delete(l.id)
                          else next.add(l.id)
                          return next
                        })
                      }
                    />
                    <span className="min-w-0 flex-1 py-2">
                      <span className="block truncate text-sm font-semibold">{l.company_name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{l.contact_name ?? l.email ?? l.phone}</span>
                    </span>
                    {usesHook && !l.hook?.trim() && <span className="shrink-0 rounded-full bg-tone-warning-bg px-2 py-0.5 text-xs font-semibold text-tone-warning">sem gancho</span>}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={generate} disabled={create.isPending || chosen.length === 0}>
                {create.isPending ? 'Gerando…' : `Gerar ${chosen.length} rascunho${chosen.length === 1 ? '' : 's'}`}
              </Button>
              {usesHook && <span className="text-sm text-muted-foreground">O modelo usa {'{{gancho}}'}: leads sem gancho saem com o trecho vazio (a revisão avisa).</span>}
            </div>
          </>
        )}
        {result && (
          <p role="status" className="text-sm text-tone-success">
            {result}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    </Plate>
  )
}

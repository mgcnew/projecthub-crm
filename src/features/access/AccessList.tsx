import { ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import { CopyButton } from '@/components/CopyButton'
import { StatusBadge } from '@/components/states'
import { isHttpUrl } from './schema'

export type AccessRow = {
  id: string
  name: string
  category: string | null
  url: string | null
  username: string | null
  manager_item: string | null
  archived_at: string | null
  projects: { name: string } | null
  clients: { name: string } | null
}

/** Lista de acessos: abrir o serviço e copiar usuário (ou o nome do item no gerenciador) em 1 clique. */
export function AccessList({ rows, showLinks = true }: { rows: AccessRow[]; showLinks?: boolean }) {
  return (
    <ul className="plate divide-y divide-border">
      {rows.map((a) => (
        <li key={a.id} className="space-y-2 px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Link to={`/app/acessos/${a.id}`} className="font-semibold hover:underline">
              {a.name}
            </Link>
            {a.category && <StatusBadge>{a.category}</StatusBadge>}
            {a.archived_at && <StatusBadge>Arquivado</StatusBadge>}
            {showLinks && (a.projects || a.clients) && (
              <span className="text-sm text-muted-foreground">
                {[a.projects?.name, a.clients?.name].filter(Boolean).join(' · ')}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {a.url && isHttpUrl(a.url) && (
              <a
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Abrir ${a.name} em nova aba`}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-sm border border-input bg-card px-2.5 text-sm font-semibold hover:bg-muted"
              >
                <ExternalLink aria-hidden="true" className="size-4" />
                Abrir
              </a>
            )}
            {a.username && (
              <span className="inline-flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">Usuário</span>
                <span className="font-mono text-sm break-all">{a.username}</span>
                <CopyButton text={a.username} label={`Copiar usuário de ${a.name}`} />
              </span>
            )}
          </div>

          {a.manager_item && (
            <p className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">No gerenciador de senhas:</span>
              <span className="font-semibold">{a.manager_item}</span>
              <CopyButton text={a.manager_item} label={`Copiar o nome do item de ${a.name} no gerenciador`} />
            </p>
          )}
        </li>
      ))}
    </ul>
  )
}

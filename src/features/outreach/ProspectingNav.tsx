import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'

const tabs = [
  { to: '/app/prospeccao', label: 'Leads', end: true },
  { to: '/app/prospeccao/importar', label: 'Importar', end: false },
  { to: '/app/prospeccao/respostas', label: 'Respostas', end: false },
  { to: '/app/prospeccao/campanhas', label: 'Campanhas', end: false },
  { to: '/app/prospeccao/modelos', label: 'Modelos', end: false },
  { to: '/app/prospeccao/fila', label: 'Fila', end: false },
  { to: '/app/prospeccao/sistemas', label: 'Sistemas', end: false },
] as const

/** Abas da área de Prospecção (cada uma é uma página). */
export function ProspectingNav() {
  return (
    <nav aria-label="Prospecção" className="border-b border-border">
      <ul className="-mb-px flex gap-1 overflow-x-auto">
        {tabs.map((t) => (
          <li key={t.to}>
            <NavLink
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                cn(
                  'inline-flex min-h-11 items-center border-b-[3px] px-3 text-sm font-semibold whitespace-nowrap transition-colors duration-150 ease-out',
                  isActive ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
                )
              }
            >
              {t.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

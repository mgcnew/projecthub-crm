import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/auth-context'
import { useUnreadCount } from '@/features/notifications/api'
import { cn } from '@/lib/utils'

const items = [
  { to: '/app', label: 'Início', end: true },
  { to: '/app/meu-dia', label: 'Meu dia', end: false },
  { to: '/app/agenda', label: 'Agenda', end: false },
  { to: '/app/tarefas', label: 'Tarefas', end: false },
  { to: '/app/reunioes', label: 'Reuniões', end: false },
  { to: '/app/projetos', label: 'Projetos', end: false },
  { to: '/app/clientes', label: 'Clientes', end: false },
  { to: '/app/notificacoes', label: 'Notificações', end: false },
]
const primaryMobile = items.slice(0, 4)
const moreMobile = items.slice(4)

function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span
      aria-label={`${count} não lida${count > 1 ? 's' : ''}`}
      className="ml-auto rounded-full bg-primary px-2 text-xs font-semibold text-primary-foreground"
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}

function link({ isActive }: { isActive: boolean }) {
  return cn(
    'flex min-h-11 items-center rounded-md px-3 text-sm font-medium',
    isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted',
  )
}

export function AppShell() {
  const { signOut } = useAuth()
  const [moreOpen, setMoreOpen] = useState(false)
  const unread = useUnreadCount().data ?? 0

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15rem_1fr]">
      <aside className="hidden border-r border-border bg-card p-3 lg:flex lg:flex-col lg:gap-1">
        <p className="px-3 py-3 font-semibold">ProjectHub CRM</p>
        <nav aria-label="Principal" className="flex flex-col gap-1">
          {items.map((i) => (
            <NavLink key={i.to} to={i.to} end={i.end} className={link}>
              {i.label}
              {i.to === '/app/notificacoes' && <UnreadBadge count={unread} />}
            </NavLink>
          ))}
        </nav>
        <Button variant="ghost" className="mt-auto justify-start" onClick={() => void signOut()}>
          Sair
        </Button>
      </aside>

      <main className="mx-auto w-full max-w-5xl space-y-6 px-4 pb-24 pt-6 lg:pb-8">
        <Outlet />
      </main>

      {moreOpen && (
        <div className="fixed inset-x-0 bottom-14 border-t border-border bg-card p-2 shadow-lg lg:hidden">
          <nav aria-label="Mais opções" className="grid gap-1">
            {moreMobile.map((i) => (
              <NavLink key={i.to} to={i.to} className={link} onClick={() => setMoreOpen(false)}>
                {i.label}
                {i.to === '/app/notificacoes' && <UnreadBadge count={unread} />}
              </NavLink>
            ))}
            <Button variant="ghost" className="justify-start" onClick={() => void signOut()}>
              Sair
            </Button>
          </nav>
        </div>
      )}

      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 grid grid-cols-5 border-t border-border bg-card p-1 lg:hidden"
      >
        {primaryMobile.map((i) => (
          <NavLink
            key={i.to}
            to={i.to}
            end={i.end}
            className={(s) => cn(link(s), 'justify-center px-1 text-xs')}
            onClick={() => setMoreOpen(false)}
          >
            {i.label}
          </NavLink>
        ))}
        <button
          type="button"
          aria-expanded={moreOpen}
          className={cn(
            'flex min-h-11 items-center justify-center rounded-md px-1 text-xs font-medium',
            moreOpen ? 'bg-primary/10 text-primary' : 'text-muted-foreground',
          )}
          onClick={() => setMoreOpen((o) => !o)}
        >
          Mais
          {unread > 0 && <span className="sr-only"> ({unread} notificações não lidas)</span>}
          {unread > 0 && <span aria-hidden="true" className="ml-1 size-2 rounded-full bg-primary" />}
        </button>
      </nav>
    </div>
  )
}

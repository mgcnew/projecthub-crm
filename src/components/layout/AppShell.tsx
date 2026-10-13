import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/auth-context'
import { useUnreadCount } from '@/features/notifications/api'
import { TimezoneBoundary } from '@/features/settings/TimezoneBoundary'
import { cn } from '@/lib/utils'
import { useOnlineStatus } from '@/lib/useOnlineStatus'

const items = [
  { to: '/app', label: 'Início', end: true },
  { to: '/app/meu-dia', label: 'Meu dia', end: false },
  { to: '/app/agenda', label: 'Agenda', end: false },
  { to: '/app/tarefas', label: 'Tarefas', end: false },
  { to: '/app/reunioes', label: 'Reuniões', end: false },
  { to: '/app/projetos', label: 'Projetos', end: false },
  { to: '/app/clientes', label: 'Clientes', end: false },
  { to: '/app/notificacoes', label: 'Notificações', end: false },
  { to: '/app/configuracoes', label: 'Configurações', end: false },
]
const primaryMobile = items.slice(0, 4)
const moreMobile = items.slice(4)
const APP_NAME = 'ProjectHub CRM'

function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span className="ml-auto rounded-full bg-primary px-2 text-xs font-semibold text-primary-foreground">
      {count > 99 ? '99+' : count}
      <span className="sr-only"> não lida{count > 1 ? 's' : ''}</span>
    </span>
  )
}

function link({ isActive }: { isActive: boolean }) {
  return cn(
    'flex min-h-11 items-center rounded-md px-3 text-sm font-medium',
    isActive ? 'bg-primary/10 text-primary-strong' : 'text-muted-foreground hover:bg-muted',
  )
}

/**
 * Acessibilidade de navegação em SPA: a cada troca de rota o foco vai para o conteúdo e o título do
 * documento acompanha o <h1> da página (que pode aparecer só depois do carregamento).
 */
function useRouteAccessibility(main: React.RefObject<HTMLElement | null>) {
  const { pathname } = useLocation()
  const lastPath = useRef(pathname)

  useEffect(() => {
    const el = main.current
    if (!el) return
    // No carregamento inicial o foco fica no topo (o skip link é o primeiro Tab); só navegações internas
    // movem o foco. Comparar com o caminho anterior também é idempotente sob o StrictMode.
    if (lastPath.current !== pathname) {
      lastPath.current = pathname
      el.focus({ preventScroll: true })
      window.scrollTo({ top: 0 })
    }

    const sync = () => {
      const h1 = el.querySelector('h1')?.textContent?.trim()
      document.title = h1 ? `${h1} · ${APP_NAME}` : APP_NAME
    }
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(el, { childList: true, subtree: true, characterData: true })
    return () => observer.disconnect()
  }, [pathname, main])
}

export function AppShell() {
  const { signOut } = useAuth()
  const [moreOpen, setMoreOpen] = useState(false)
  const unread = useUnreadCount().data ?? 0
  const online = useOnlineStatus()
  const main = useRef<HTMLElement>(null)
  useRouteAccessibility(main)

  useEffect(() => {
    if (!moreOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMoreOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [moreOpen])

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15rem_1fr]">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-strong focus:shadow-lg focus:ring-[3px] focus:ring-ring/50"
        onClick={(e) => {
          e.preventDefault()
          main.current?.focus()
        }}
      >
        Pular para o conteúdo
      </a>

      <aside className="hidden border-r border-border bg-card p-3 lg:flex lg:flex-col lg:gap-1">
        <p className="px-3 py-3 font-semibold">{APP_NAME}</p>
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

      <div className="min-w-0">
        {!online && (
          <p role="status" className="border-b border-warning/40 bg-warning/20 px-4 py-2 text-sm text-amber-900">
            Sem conexão. Você pode continuar lendo, mas as alterações só serão salvas quando a conexão voltar.
          </p>
        )}
        <main
          id="conteudo"
          ref={main}
          tabIndex={-1}
          className="mx-auto w-full max-w-5xl space-y-6 px-4 pb-24 pt-6 outline-none lg:pb-8"
        >
          <TimezoneBoundary>
            <Outlet />
          </TimezoneBoundary>
        </main>
      </div>

      {moreOpen && (
        <div
          id="menu-mais"
          className="fixed inset-x-0 bottom-14 border-t border-border bg-card p-2 shadow-lg lg:hidden"
        >
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
          aria-controls="menu-mais"
          className={cn(
            'flex min-h-11 items-center justify-center rounded-md px-1 text-xs font-medium',
            moreOpen ? 'bg-primary/10 text-primary-strong' : 'text-muted-foreground',
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

import { useEffect, useRef, useState } from 'react'
import {
  Bell,
  Building2,
  CalendarCheck2,
  CalendarDays,
  FolderKanban,
  House,
  KeyRound,
  ListChecks,
  Megaphone,
  LogOut,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'
import { NavLink, useLocation, useNavigate, useRoutes, type RouteObject } from 'react-router-dom'
import { EntityOverlay } from '@/components/entity/EntityOverlay'
import { LineRegistry } from '@/components/LineRegistry'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/auth-context'
import { useUnreadCount } from '@/features/notifications/api'
import { SearchDialog } from '@/features/search/SearchDialog'
import { TimezoneBoundary } from '@/features/settings/TimezoneBoundary'
import { matchEntityRoute } from '@/lib/entityRoutes'
import { cn } from '@/lib/utils'
import { useIsDesktop } from '@/lib/useMediaQuery'
import { useOnlineStatus } from '@/lib/useOnlineStatus'
import { usePersistedState } from '@/lib/usePersistedState'

// O ícone acompanha o nome, nunca o substitui. Grupos só organizam o menu lateral do desktop.
type NavItem = { to: string; label: string; end: boolean; icon: LucideIcon; group: string }
const items: NavItem[] = [
  { to: '/app', label: 'Início', end: true, icon: House, group: 'Dia a dia' },
  { to: '/app/meu-dia', label: 'Meu dia', end: false, icon: CalendarCheck2, group: 'Dia a dia' },
  { to: '/app/agenda', label: 'Agenda', end: false, icon: CalendarDays, group: 'Dia a dia' },
  { to: '/app/tarefas', label: 'Tarefas', end: false, icon: ListChecks, group: 'Dia a dia' },
  { to: '/app/reunioes', label: 'Reuniões', end: false, icon: UsersRound, group: 'Dia a dia' },
  { to: '/app/projetos', label: 'Projetos', end: false, icon: FolderKanban, group: 'Negócio' },
  { to: '/app/clientes', label: 'Clientes', end: false, icon: Building2, group: 'Negócio' },
  { to: '/app/prospeccao', label: 'Prospecção', end: false, icon: Megaphone, group: 'Negócio' },
  { to: '/app/acessos', label: 'Acessos', end: false, icon: KeyRound, group: 'Negócio' },
  { to: '/app/notificacoes', label: 'Notificações', end: false, icon: Bell, group: 'Conta' },
  { to: '/app/configuracoes', label: 'Configurações', end: false, icon: Settings, group: 'Conta' },
]
const primaryMobile = items.slice(0, 4)
const moreMobile = items.slice(4)
const desktopItems = items.filter((item) => item.to !== '/app/notificacoes')
const desktopGroups = [...new Set(desktopItems.map((i) => i.group))].map((g) => ({
  name: g,
  items: desktopItems.filter((i) => i.group === g),
}))
const APP_NAME = 'ProjectHub CRM'
const validateSidebarCollapsed = (value: unknown): boolean | null => (typeof value === 'boolean' ? value : null)

function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span className="ml-auto rounded-full bg-tone-info-bg px-1.5 text-xs font-bold text-tone-info tabular-nums">
      {count > 99 ? '99+' : count}
      <span className="sr-only"> não lida{count > 1 ? 's' : ''}</span>
    </span>
  )
}

function link({ isActive }: { isActive: boolean }) {
  return cn(
    'flex min-h-10 items-center gap-3 rounded-md px-3 text-sm font-semibold transition-colors duration-150 ease-out max-lg:min-h-11',
    isActive ? 'bg-primary text-primary-foreground shadow-card' : 'text-tone-neutral hover:bg-muted hover:text-foreground',
  )
}

/**
 * Acessibilidade de navegação em SPA: a cada troca de rota o foco vai para o conteúdo e o título do
 * documento acompanha o <h1> da página (que pode aparecer só depois do carregamento).
 */
function useRouteAccessibility(main: React.RefObject<HTMLElement | null>, overlayOpen: boolean) {
  const { pathname } = useLocation()
  const lastPath = useRef(pathname)

  useEffect(() => {
    const el = main.current
    if (!el) return
    // No carregamento inicial o foco fica no topo (o skip link é o primeiro Tab); só navegações internas
    // movem o foco. Comparar com o caminho anterior também é idempotente sob o StrictMode.
    if (lastPath.current !== pathname) {
      lastPath.current = pathname
      // Com o painel aberto o foco é do diálogo; a página de fundo não rola nem recebe foco.
      if (!overlayOpen) {
        el.focus({ preventScroll: true })
        window.scrollTo({ top: 0 })
      }
    }

    if (overlayOpen) return

    const sync = () => {
      const h1 = el.querySelector('h1')?.textContent?.trim()
      document.title = h1 ? `${h1} · ${APP_NAME}` : APP_NAME
    }
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(el, { childList: true, subtree: true, characterData: true })
    return () => observer.disconnect()
  }, [pathname, main, overlayOpen])
}

/** Última página (não-registro) visitada: é o fundo sobre o qual o painel de registro abre. */
type Origin = { pathname: string; search: string; idx: number | null }

export function AppShell({ pages }: { pages: RouteObject[] }) {
  const { signOut } = useAuth()
  const [moreOpen, setMoreOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = usePersistedState(
    'projecthub:sidebar-collapsed',
    false,
    validateSidebarCollapsed,
  )
  const unread = useUnreadCount().data ?? 0
  const online = useOnlineStatus()
  const main = useRef<HTMLElement>(null)

  // Registro (tarefa, projeto…) abre em painel por cima da página de origem no desktop e como página
  // inteira abaixo de 1024px. A URL é sempre a do registro: F5, link e Voltar funcionam nos dois modos.
  const location = useLocation()
  const navigate = useNavigate()
  const desktop = useIsDesktop()
  const entity = matchEntityRoute(location.pathname)
  const overlayOpen = desktop && entity !== null
  const [origin, setOrigin] = useState<Origin | null>(null)
  const historyIdx = () => (window.history.state as { idx?: number } | null)?.idx ?? null

  // Ajuste de estado durante a renderização (padrão do React para derivar de props): ao pousar numa
  // página que não é registro, ela vira a origem dos próximos painéis.
  if (!entity && (origin?.pathname !== location.pathname || origin?.search !== location.search)) {
    setOrigin({ pathname: location.pathname, search: location.search, idx: historyIdx() })
  }

  const pageLocation = overlayOpen ? { pathname: origin?.pathname ?? entity.fallback, search: origin?.search ?? '' } : location
  const page = useRoutes(pages, pageLocation)
  const overlayContent = useRoutes(pages, location)
  useRouteAccessibility(main, overlayOpen)

  const closeOverlay = () => {
    const here = historyIdx()
    if (origin && origin.idx !== null && here !== null && here > origin.idx) navigate(origin.idx - here)
    else navigate(origin ? origin.pathname + origin.search : (entity?.fallback ?? '/app'), { replace: true })
  }

  useEffect(() => {
    if (!moreOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMoreOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [moreOpen])

  // Ctrl/Cmd+K abre e fecha a busca global em qualquer tela do app.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setMoreOpen(false)
        setSearchOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div
      className={cn(
        'min-h-dvh lg:grid lg:transition-[grid-template-columns] lg:duration-200 lg:ease-out',
        sidebarCollapsed ? 'lg:grid-cols-[4.25rem_minmax(0,1fr)]' : 'lg:grid-cols-[15rem_minmax(0,1fr)]',
      )}
    >
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:border focus:border-border focus:bg-card focus:shadow-pop focus:px-4 focus:py-2 focus:text-sm focus:font-semibold"
        onClick={(e) => {
          e.preventDefault()
          main.current?.focus()
        }}
      >
        Pular para o conteúdo
      </a>

      <aside
        className={cn(
          'sticky top-0 hidden h-dvh border-r border-border bg-card py-5 lg:flex lg:flex-col lg:gap-1',
          sidebarCollapsed ? 'px-2' : 'px-3',
        )}
      >
        <div className={cn('flex min-h-11 items-center', sidebarCollapsed ? 'flex-col gap-2' : 'gap-2.5 px-3 pb-5')}>
          <span
            aria-hidden="true"
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-bold text-card shadow-card"
          >
            P
          </span>
          {!sidebarCollapsed && <span className="min-w-0 flex-1 text-[1.0625rem] font-bold tracking-[-0.01em]">ProjectHub</span>}
          <button
            type="button"
            aria-label={sidebarCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
            aria-expanded={!sidebarCollapsed}
            aria-controls="navegacao-principal"
            title={sidebarCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
            onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
            className={cn(
              'inline-flex size-9 shrink-0 items-center justify-center rounded-sm text-tone-neutral hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring',
              sidebarCollapsed && 'size-11',
            )}
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen aria-hidden="true" className="size-[1.125rem]" strokeWidth={2} />
            ) : (
              <PanelLeftClose aria-hidden="true" className="size-[1.125rem]" strokeWidth={2} />
            )}
          </button>
        </div>
        <button
          type="button"
          aria-keyshortcuts="Control+K Meta+K"
          aria-label="Buscar"
          title={sidebarCollapsed ? 'Buscar' : undefined}
          onClick={() => setSearchOpen(true)}
          className={cn(
            'mb-1 flex min-h-10 items-center gap-3 rounded-md border border-border bg-background text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground',
            sidebarCollapsed ? 'justify-center px-0' : 'px-3',
          )}
        >
          <Search aria-hidden="true" className="size-[1.125rem] shrink-0" strokeWidth={2} />
          <span className={sidebarCollapsed ? 'sr-only' : ''}>Buscar</span>
          {!sidebarCollapsed && (
            <kbd className="ml-auto rounded-sm border border-border bg-card px-1.5 font-sans text-[0.6875rem] font-semibold text-muted-foreground">
              Ctrl K
            </kbd>
          )}
        </button>
        <nav id="navegacao-principal" aria-label="Principal" className="flex flex-col">
          {desktopGroups.map((g) => (
            <div key={g.name} className="flex flex-col gap-0.5 pt-3">
              {sidebarCollapsed ? (
                <span aria-hidden="true" className="mx-auto mb-1 h-px w-6 bg-border" />
              ) : (
                <span aria-hidden="true" className="px-3 pb-1 text-xs font-semibold text-muted-foreground">
                  {g.name}
                </span>
              )}
              {g.items.map((i) => (
                <NavLink
                  key={i.to}
                  to={i.to}
                  end={i.end}
                  title={sidebarCollapsed ? i.label : undefined}
                  className={(state) => cn(link(state), sidebarCollapsed && 'justify-center px-0')}
                >
                  <i.icon aria-hidden="true" className="size-[1.125rem] shrink-0" strokeWidth={2} />
                  <span className={sidebarCollapsed ? 'sr-only' : ''}>{i.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <Button
          variant="ghost"
          aria-label="Sair"
          title={sidebarCollapsed ? 'Sair' : undefined}
          className={cn('mt-auto', sidebarCollapsed ? 'justify-center px-0' : 'justify-start px-3')}
          onClick={() => void signOut()}
        >
          <LogOut aria-hidden="true" className="size-[1.125rem] shrink-0" strokeWidth={2} />
          <span className={sidebarCollapsed ? 'sr-only' : ''}>Sair</span>
        </Button>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 hidden h-14 items-center justify-end border-b border-border bg-background px-4 lg:flex lg:px-6">
          <NavLink
            to="/app/notificacoes"
            aria-label={`Notificações${unread > 0 ? `, ${unread} não lida${unread > 1 ? 's' : ''}` : ''}`}
            title="Notificações"
            className={({ isActive }) =>
              cn(
                'relative inline-flex size-10 items-center justify-center rounded-md text-tone-neutral hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring',
                isActive && 'bg-muted text-foreground',
              )
            }
          >
            <Bell aria-hidden="true" className="size-5" strokeWidth={2} />
            {unread > 0 && (
              <span
                aria-hidden="true"
                className="absolute -top-0.5 -right-0.5 min-w-5 rounded-full border-2 border-background bg-primary px-1 text-center text-[0.6875rem] leading-4 font-bold tabular-nums text-card"
              >
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </NavLink>
        </header>
        {!online && (
          <p role="status" className="border-b border-[#f3dfa2] bg-tone-warning-bg px-4 py-2 text-sm font-medium text-tone-warning">
            Sem conexão. Você pode continuar lendo, mas as alterações só serão salvas quando a conexão voltar.
          </p>
        )}
        <TimezoneBoundary>
          <LineRegistry>
            <main
              id="conteudo"
              ref={main}
              tabIndex={-1}
              className="mx-auto w-full max-w-[100rem] space-y-6 px-4 pt-5 pb-28 outline-none sm:px-5 lg:px-6 lg:pt-6 lg:pb-8"
            >
              {page}
            </main>
            {overlayOpen && <EntityOverlay onClose={closeOverlay}>{overlayContent}</EntityOverlay>}
          </LineRegistry>
        </TimezoneBoundary>
      </div>

      {moreOpen && (
        <div
          id="menu-mais"
          className="fixed inset-x-2 bottom-[4.75rem] z-30 rounded-xl border border-border bg-card p-2 shadow-pop lg:hidden"
        >
          <nav aria-label="Mais opções" className="grid gap-1">
            <button
              type="button"
              className={link({ isActive: false })}
              onClick={() => {
                setMoreOpen(false)
                setSearchOpen(true)
              }}
            >
              <Search aria-hidden="true" className="size-[1.125rem] shrink-0" strokeWidth={2} />
              Buscar
            </button>
            {moreMobile.map((i) => (
              <NavLink key={i.to} to={i.to} className={link} onClick={() => setMoreOpen(false)}>
                <i.icon aria-hidden="true" className="size-[1.125rem] shrink-0" strokeWidth={2} />
                {i.label}
                {i.to === '/app/notificacoes' && <UnreadBadge count={unread} />}
              </NavLink>
            ))}
            <Button variant="ghost" className="justify-start px-3" onClick={() => void signOut()}>
              Sair
            </Button>
          </nav>
        </div>
      )}

      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />

      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 gap-1 border-t border-border bg-card px-1 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] lg:hidden"
      >
        {primaryMobile.map((i) => (
          <NavLink
            key={i.to}
            to={i.to}
            end={i.end}
            className={(s) => cn(link(s), 'min-h-14 flex-col justify-center gap-1 px-1 text-xs')}
            onClick={() => setMoreOpen(false)}
          >
            <i.icon aria-hidden="true" className="size-5 shrink-0" strokeWidth={2} />
            {i.label}
          </NavLink>
        ))}
        <button
          type="button"
          aria-expanded={moreOpen}
          aria-controls="menu-mais"
          className={cn(
            'relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-md px-1 text-xs font-semibold',
            moreOpen ? 'bg-primary text-primary-foreground' : 'text-tone-neutral',
          )}
          onClick={() => setMoreOpen((o) => !o)}
        >
          <MoreHorizontal aria-hidden="true" className="size-5" strokeWidth={2} />
          Mais
          {unread > 0 && <span className="sr-only"> ({unread} notificações não lidas)</span>}
          {unread > 0 && (
            <span aria-hidden="true" className="absolute top-2 right-[calc(50%-1.1rem)] size-2.5 rounded-full bg-primary ring-2 ring-card" />
          )}
        </button>
      </nav>
    </div>
  )
}

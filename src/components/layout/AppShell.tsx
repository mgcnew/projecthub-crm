import { NavLink, Outlet } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/auth-context'
import { cn } from '@/lib/utils'

const items = [
  { to: '/app', label: 'Início', end: true },
  { to: '/app/clientes', label: 'Clientes', end: false },
  { to: '/app/projetos', label: 'Projetos', end: false },
]

function link({ isActive }: { isActive: boolean }) {
  return cn(
    'flex min-h-11 items-center rounded-md px-3 text-sm font-medium',
    isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted',
  )
}

export function AppShell() {
  const { signOut } = useAuth()
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15rem_1fr]">
      <aside className="hidden border-r border-border bg-card p-3 lg:flex lg:flex-col lg:gap-1">
        <p className="px-3 py-3 font-semibold">ProjectHub CRM</p>
        <nav aria-label="Principal" className="flex flex-col gap-1">
          {items.map((i) => (
            <NavLink key={i.to} to={i.to} end={i.end} className={link}>
              {i.label}
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

      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 grid grid-cols-3 border-t border-border bg-card p-1 lg:hidden"
      >
        {items.map((i) => (
          <NavLink key={i.to} to={i.to} end={i.end} className={(s) => cn(link(s), 'justify-center')}>
            {i.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

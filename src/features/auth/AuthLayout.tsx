import type { ReactNode } from 'react'

/** Moldura compartilhada das telas sem sessão, com sinalização e formulário responsivos. */
export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background lg:p-8 xl:p-12">
      <div className="grid min-h-dvh w-full max-w-[1240px] bg-card lg:min-h-[min(760px,calc(100dvh-4rem))] lg:grid-cols-[0.95fr_1.05fr] lg:border lg:border-border">
        <aside aria-hidden="true" className="relative hidden flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground lg:flex xl:p-12">
          <p className="flex items-center gap-3 text-xl font-bold tracking-[-0.01em]">
            <span className="inline-flex size-9 items-center justify-center bg-card text-lg text-primary">P</span>
            ProjectHub
          </p>

          <div className="my-16">
            <p className="max-w-80 text-3xl leading-tight font-bold tracking-[-0.02em] text-balance">Seu dia, estação por estação.</p>
            <p className="mt-4 max-w-72 leading-relaxed text-card/75">Clientes, projetos, reuniões e tarefas na mesma linha.</p>
            <svg viewBox="0 0 440 210" className="mt-12 w-full" fill="none">
              <path d="M0 110H440" stroke="currentColor" strokeWidth="4" />
              <path d="M90 110V172H440M205 110V48H440" stroke="currentColor" strokeOpacity="0.3" strokeWidth="4" />
              <g fill="var(--primary)" stroke="currentColor" strokeWidth="4">
                <circle cx="90" cy="110" r="9" />
                <circle cx="205" cy="110" r="9" />
                <circle cx="325" cy="110" r="9" />
                <circle cx="417" cy="48" r="7" />
                <circle cx="417" cy="172" r="7" />
              </g>
              <g fill="currentColor" fontSize="13" fontWeight="600">
                <text x="90" y="84" textAnchor="middle">Clientes</text>
                <text x="205" y="143" textAnchor="middle">Projetos</text>
                <text x="325" y="84" textAnchor="middle">Tarefas</text>
                <text x="398" y="40" textAnchor="end">Reuniões</text>
              </g>
            </svg>
          </div>

          <div className="h-px w-full bg-card/25" />
        </aside>

        <main className="flex min-w-0 flex-col px-6 py-8 sm:px-12 lg:px-12 lg:py-10 xl:px-16">
          <p className="flex items-center gap-3 text-lg font-bold tracking-[-0.01em]">
            <span aria-hidden="true" className="inline-flex size-8 items-center justify-center bg-primary text-base text-primary-foreground lg:hidden">P</span>
            <span className="lg:text-sm lg:text-muted-foreground">ProjectHub<span className="font-normal"> CRM</span></span>
          </p>
          <div className="flex flex-1 items-center py-12 sm:py-16 lg:py-12">
            <div className="mx-auto w-full max-w-sm space-y-8">
              <header className="space-y-3 border-b-2 border-rule-strong pb-6">
                <h1 className="text-[1.875rem] leading-tight font-bold tracking-[-0.02em]">{title}</h1>
                {subtitle && <p className="max-w-xs leading-relaxed text-muted-foreground">{subtitle}</p>}
              </header>
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

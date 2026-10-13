import type { ReactNode } from 'react'

/** Moldura das telas sem sessão (entrar, recuperar e redefinir senha): painel de marca e coluna do formulário. */
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
    <div className="grid min-h-dvh bg-background lg:grid-cols-[minmax(0,1fr)_minmax(26rem,32rem)]">
      {/* Painel de marca (desktop): o dia como diagrama de linhas; decorativo. */}
      <aside aria-hidden="true" className="relative hidden overflow-hidden bg-foreground text-card lg:flex lg:flex-col lg:justify-between lg:p-12">
        <p className="flex items-center gap-3 text-xl font-bold tracking-[-0.01em]">
          <span className="inline-flex size-8 items-center justify-center bg-card text-base text-foreground">P</span>
          ProjectHub
        </p>
        <div className="relative h-64">
          <span className="absolute top-[42%] left-0 h-2.5 w-full bg-[#0455a1]" />
          <span className="absolute top-[22%] left-[38%] h-2.5 w-[62%] bg-[#007e5e]" />
          <span className="absolute top-[22%] left-[38%] h-[calc(20%+0.625rem)] w-2.5 bg-[#007e5e]" />
          <span className="absolute top-[62%] left-[18%] h-2.5 w-[82%] bg-[#ffd400]" />
          <span className="absolute top-[42%] left-[18%] h-[calc(20%+0.625rem)] w-2.5 bg-[#ffd400]" />
          {[18, 38, 64, 86].map((x) => (
            <span key={x} className="absolute top-[42%] size-7 -translate-x-1/2 -translate-y-[0.6rem] rounded-full border-[6px] border-card bg-foreground" style={{ left: `${x}%` }} />
          ))}
          <span className="absolute top-[42%] left-[64%] size-7 -translate-x-1/2 -translate-y-[0.6rem] rounded-full border-[6px] border-[#ee372f] bg-foreground" />
        </div>
        <div className="max-w-md space-y-2">
          <p className="text-3xl leading-tight font-bold tracking-[-0.02em]">Seu dia, estação por estação.</p>
          <p className="text-[#c4cad0]">Clientes, projetos, reuniões e tarefas na mesma linha.</p>
        </div>
      </aside>

      <main className="flex flex-col justify-center gap-8 px-5 py-10 sm:px-10">
        <p className="flex items-center gap-2.5 text-lg font-bold tracking-[-0.01em] lg:hidden">
          <span aria-hidden="true" className="inline-flex size-7 items-center justify-center bg-foreground text-sm text-card">P</span>
          ProjectHub
        </p>
        <header className="space-y-1 border-b-2 border-rule-strong pb-4">
          <h1 className="text-[1.875rem] leading-tight font-bold tracking-[-0.02em]">{title}</h1>
          {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
        </header>
        {children}
      </main>
    </div>
  )
}

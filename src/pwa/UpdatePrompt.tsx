import { RefreshCw } from 'lucide-react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { Button } from '@/components/ui/button'

/**
 * Registra o service worker e avisa quando há versão nova. A troca só acontece quando a pessoa clica em
 * "Atualizar" (recarrega a página): nada muda no meio de um formulário. Sem service worker (dev, navegador
 * sem suporte) o componente não aparece.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null
  return (
    <div
      role="status"
      className="fixed right-3 bottom-[5.25rem] left-3 z-40 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-pop sm:left-auto sm:max-w-sm lg:right-6 lg:bottom-6"
    >
      <RefreshCw aria-hidden="true" className="size-4 shrink-0 text-primary" />
      <p className="min-w-0 flex-1 text-sm font-medium">Há uma versão nova do aplicativo.</p>
      <div className="flex gap-2">
        <Button size="sm" variant="ghost" onClick={() => setNeedRefresh(false)}>
          Depois
        </Button>
        <Button size="sm" onClick={() => void updateServiceWorker(true)}>
          Atualizar
        </Button>
      </div>
    </div>
  )
}

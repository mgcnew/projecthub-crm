import { Building2, KeyRound, ShieldCheck, SlidersHorizontal, UserRound } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { PageTabs } from '@/components/PageTabs'
import { PageHeader } from '@/components/states'
import { VaultTab } from '@/features/vault/VaultTab'
import { EmailSection } from './EmailSection'
import { ProfileTab } from './ProfileTab'
import { MfaSection, PasswordSection } from './SecuritySection'
import { TimezoneSection } from './TimezoneSection'
import { WorkspaceTab } from './WorkspaceTab'

/** Configurações em abas (`?aba=perfil|seguranca|cofre|preferencias|espaco`): perfil, acesso, preferências e espaço. */
export function SettingsPage() {
  const [, setParams] = useSearchParams()
  const goToAccount = () => setParams({ aba: 'seguranca' }, { replace: true })

  return (
    <>
      <PageHeader title="Configurações" description="Seu perfil, o acesso à conta e as preferências do aplicativo." />
      <PageTabs
        label="Seções de configurações"
        tabs={[
          { id: 'perfil', label: 'Perfil', icon: UserRound, content: <ProfileTab goToAccount={goToAccount} /> },
          {
            id: 'seguranca',
            label: 'Conta e segurança',
            icon: ShieldCheck,
            content: (
              <>
                <EmailSection />
                <PasswordSection />
                <MfaSection />
              </>
            ),
          },
          { id: 'cofre', label: 'Cofre', icon: KeyRound, content: <VaultTab /> },
          { id: 'preferencias', label: 'Preferências', icon: SlidersHorizontal, content: <TimezoneSection /> },
          { id: 'espaco', label: 'Espaço de trabalho', icon: Building2, content: <WorkspaceTab /> },
        ]}
      />
    </>
  )
}

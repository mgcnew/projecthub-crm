import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter, Link } from 'react-router-dom'
import { AppShell } from './AppShell'

vi.mock('@/features/auth/auth-context', () => ({ useAuth: () => ({ signOut: vi.fn() }) }))
vi.mock('@/features/notifications/api', () => ({ useUnreadCount: () => ({ data: 3 }) }))
vi.mock('@/features/settings/TimezoneBoundary', () => ({ TimezoneBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</> }))
vi.mock('@/components/LineRegistry', () => ({ LineRegistry: ({ children }: { children: React.ReactNode }) => <>{children}</> }))

function Page({ title, to }: { title: string; to?: string }) {
  return (
    <>
      <h1>{title}</h1>
      {to && <Link to={to}>ir</Link>}
    </>
  )
}

const pages = [
  { path: '/app', element: <Page title="Central do dia" to="/app/agenda" /> },
  { path: '/app/agenda', element: <Page title="Agenda" /> },
]

function renderShell() {
  const router = createMemoryRouter(
    [
      {
        element: <AppShell pages={pages} />,
        children: pages,
      },
    ],
    { initialEntries: ['/app'] },
  )
  return render(<RouterProvider router={router} />)
}

describe('AppShell — acessibilidade', () => {
  it('oferece skip link como primeiro item e leva o foco ao conteúdo', async () => {
    renderShell()
    const skip = screen.getByRole('link', { name: 'Pular para o conteúdo' })
    expect(skip).toHaveAttribute('href', '#conteudo')

    await userEvent.click(skip)
    expect(screen.getByRole('main')).toHaveFocus()
  })

  it('no carregamento inicial o foco não vai ao conteúdo (o skip link é o primeiro Tab)', async () => {
    renderShell()
    expect(screen.getByRole('main')).not.toHaveFocus()
    await userEvent.tab()
    expect(screen.getByRole('link', { name: 'Pular para o conteúdo' })).toHaveFocus()
  })

  it('o título do documento acompanha o h1 e muda com a rota', async () => {
    renderShell()
    expect(document.title).toBe('Central do dia · ProjectHub CRM')

    await userEvent.click(screen.getByRole('link', { name: 'ir' }))
    expect(await screen.findByRole('heading', { name: 'Agenda' })).toBeInTheDocument()
    expect(document.title).toBe('Agenda · ProjectHub CRM')
    expect(screen.getByRole('main')).toHaveFocus()
  })

  it('avisa quando fica sem conexão e some ao voltar', () => {
    renderShell()
    expect(screen.queryByText(/Sem conexão/)).not.toBeInTheDocument()

    act(() => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
      window.dispatchEvent(new Event('offline'))
    })
    expect(screen.getByRole('status')).toHaveTextContent(/Sem conexão/)

    act(() => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
      window.dispatchEvent(new Event('online'))
    })
    expect(screen.queryByText(/Sem conexão/)).not.toBeInTheDocument()
  })

  it('o menu "Mais" fecha com Escape e informa o contador de não lidas', async () => {
    renderShell()
    const more = screen.getByRole('button', { name: /Mais/ })
    expect(more).toHaveAccessibleName(/3 notificações não lidas/)

    await userEvent.click(more)
    expect(more).toHaveAttribute('aria-expanded', 'true')
    await userEvent.keyboard('{Escape}')
    expect(more).toHaveAttribute('aria-expanded', 'false')
  })
})

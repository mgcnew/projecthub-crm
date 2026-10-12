import { render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { routes } from './routes'

const { getSession } = vi.hoisted(() => ({
  getSession: vi.fn(async () => ({ data: { session: null } })),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession,
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signOut: vi.fn(),
      signInWithPassword: vi.fn(),
    },
  },
}))

function renderAt(path: string) {
  return render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />)
}

describe('rotas', () => {
  it('redireciona visitante de /app para o login', async () => {
    renderAt('/app')
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
  })
  it('redireciona / para o login quando não autenticado', async () => {
    renderAt('/')
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
  })
  it('renderiza 404 para rota desconhecida', async () => {
    renderAt('/xyz')
    expect(await screen.findByRole('heading', { name: /não encontrada/i })).toBeInTheDocument()
  })
})

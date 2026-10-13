import { render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { RouteError } from './RouteError'

function Boom(): never {
  throw new Error('falha de render')
}

describe('RouteError', () => {
  it('mostra um fallback com recuperação quando a tela quebra', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const router = createMemoryRouter(
      [{ path: '/', element: <Boom />, errorElement: <RouteError /> }],
      { initialEntries: ['/'] },
    )
    render(<RouterProvider router={router} />)

    expect(await screen.findByRole('heading', { name: 'Algo deu errado' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(/dados não foram alterados/)
    expect(screen.getByRole('button', { name: 'Recarregar' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir para o início' })).toHaveAttribute('href', '/app')
    spy.mockRestore()
  })
})

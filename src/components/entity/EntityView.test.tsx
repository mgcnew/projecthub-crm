import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter, useLocation } from 'react-router-dom'
import { EntityView } from './EntityView'
import { OverlayContext } from './OverlayContext'

function Probe() {
  const l = useLocation()
  return <output data-testid="loc">{l.search}</output>
}

function setup(initial = '/x', overlay = false) {
  const tabs = [
    { id: 'detalhes', label: 'Detalhes', content: <input aria-label="Título" /> },
    { id: 'lembretes', label: 'Lembretes', content: <p>Conteúdo de lembretes</p> },
    { id: 'atividade', label: 'Atividade', badge: 3, content: <p>Conteúdo de atividade</p> },
  ]
  const el = (
    <>
      <EntityView kind="Tarefa" title="Revisar escopo" tabs={tabs} />
      <Probe />
    </>
  )
  const router = createMemoryRouter(
    [{ path: '/x', element: overlay ? <OverlayContext.Provider value={{ titleId: 'ttl', expanded: false }}>{el}</OverlayContext.Provider> : el }],
    { initialEntries: [initial] },
  )
  return render(<RouterProvider router={router} />)
}

describe('EntityView', () => {
  it('mostra a primeira aba e carrega as outras só ao abrir', () => {
    setup()
    expect(screen.getByRole('tab', { name: 'Detalhes' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByLabelText('Título')).toBeVisible()
    expect(screen.queryByText('Conteúdo de lembretes')).not.toBeInTheDocument()
  })

  it('troca de aba, grava ?aba= na URL e mantém a aba visitada montada', async () => {
    setup()
    await userEvent.click(screen.getByRole('tab', { name: 'Lembretes' }))
    expect(screen.getByText('Conteúdo de lembretes')).toBeVisible()
    expect(screen.getByTestId('loc')).toHaveTextContent('?aba=lembretes')
    // o formulário da aba anterior continua montado (só escondido): o que foi digitado não se perde
    expect(screen.getByLabelText('Título', { selector: 'input' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: 'Detalhes' }))
    expect(screen.getByTestId('loc')).toHaveTextContent('')
  })

  it('abre direto na aba pedida pela URL e ignora aba desconhecida', () => {
    const { unmount } = setup('/x?aba=atividade')
    expect(screen.getByRole('tab', { name: /Atividade/ })).toHaveAttribute('aria-selected', 'true')
    unmount()
    setup('/x?aba=inexistente')
    expect(screen.getByRole('tab', { name: 'Detalhes' })).toHaveAttribute('aria-selected', 'true')
  })

  it('navega por teclado: setas, Home e End com tabindex móvel', async () => {
    setup()
    const first = screen.getByRole('tab', { name: 'Detalhes' })
    first.focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Lembretes' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Lembretes' })).toHaveAttribute('tabindex', '0')
    expect(first).toHaveAttribute('tabindex', '-1')
    await userEvent.keyboard('{End}')
    expect(screen.getByRole('tab', { name: /Atividade/ })).toHaveAttribute('aria-selected', 'true')
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Detalhes' })).toHaveAttribute('aria-selected', 'true')
  })

  it('no painel o título é um h2 ligado ao diálogo; na página é o h1', () => {
    const { unmount } = setup('/x', true)
    expect(screen.getByRole('heading', { level: 2, name: 'Revisar escopo' })).toHaveAttribute('id', 'ttl')
    unmount()
    setup('/x', false)
    expect(screen.getByRole('heading', { level: 1, name: 'Revisar escopo' })).toBeInTheDocument()
  })
})

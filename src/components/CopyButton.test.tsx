import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CopyButton } from './CopyButton'

describe('CopyButton', () => {
  it('copia o texto e avisa', async () => {
    const user = userEvent.setup()
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    render(<CopyButton text="eu@exemplo.com" label="Copiar usuário de Gmail" />)
    await user.click(screen.getByRole('button', { name: 'Copiar usuário de Gmail' }))
    expect(writeText).toHaveBeenCalledWith('eu@exemplo.com')
    expect(await screen.findByText('Copiado para a área de transferência')).toBeTruthy()
  })

  it('informa quando a cópia falha', async () => {
    const user = userEvent.setup()
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('negado'))
    render(<CopyButton text="x" label="Copiar" />)
    await user.click(screen.getByRole('button', { name: 'Copiar' }))
    expect(await screen.findByText('Não foi possível copiar')).toBeTruthy()
  })
})

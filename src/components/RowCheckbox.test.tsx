import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RowCheckbox } from './RowCheckbox'

describe('RowCheckbox', () => {
  it('expõe nome acessível e dispara a alteração', async () => {
    const onChange = vi.fn()
    render(<RowCheckbox label="Concluir Ligar para o cliente" checked={false} onChange={onChange} />)
    const box = screen.getByRole('checkbox', { name: 'Concluir Ligar para o cliente' })
    await userEvent.click(box)
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('a área de toque é o label de 44px, não o controle de 20px', () => {
    const { container } = render(<RowCheckbox label="x" checked onChange={() => {}} />)
    const label = container.querySelector('label')!
    expect(label.className).toContain('size-11')
    expect(label.className).toContain('lg:size-8')
  })

  it('respeita desabilitado', () => {
    render(<RowCheckbox label="x" checked={false} disabled onChange={() => {}} />)
    expect(screen.getByRole('checkbox')).toBeDisabled()
  })
})

import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfirmDialog } from './ConfirmDialog'

// jsdom não implementa showModal/close do <dialog>.
beforeAll(() => {
  const proto = HTMLDialogElement.prototype as unknown as Record<string, unknown>
  proto.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  proto.close = function (this: HTMLDialogElement) {
    this.removeAttribute('open')
  }
})

function setup(props: Partial<React.ComponentProps<typeof ConfirmDialog>> = {}) {
  const onConfirm = vi.fn()
  const onCancel = vi.fn()
  render(
    <ConfirmDialog
      open
      title="Arquivar “Acme”?"
      description="O cliente sai das listas ativas."
      confirmLabel="Arquivar cliente"
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...props}
    />,
  )
  return { onConfirm, onCancel }
}

describe('ConfirmDialog', () => {
  it('abre como alertdialog nomeado e descrito', () => {
    setup()
    const dialog = screen.getByRole('alertdialog', { name: 'Arquivar “Acme”?' })
    expect(dialog).toHaveAttribute('open')
    expect(dialog).toHaveAccessibleDescription('O cliente sai das listas ativas.')
  })

  it('o foco inicial é a opção segura (Voltar)', () => {
    setup()
    expect(screen.getByRole('button', { name: 'Voltar' })).toHaveFocus()
  })

  it('confirma e cancela pelos botões', async () => {
    const { onConfirm, onCancel } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Arquivar cliente' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    await userEvent.click(screen.getByRole('button', { name: 'Voltar' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('Esc (evento cancel) delega ao onCancel e não fecha sozinho', () => {
    const { onCancel } = setup()
    const dialog = screen.getByRole('alertdialog')
    const ev = new Event('cancel', { cancelable: true })
    dialog.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(true)
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('clique no fundo cancela; clique no conteúdo não', () => {
    const { onCancel } = setup()
    const dialog = screen.getByRole('alertdialog')
    fireEvent.click(screen.getByRole('heading', { name: 'Arquivar “Acme”?' }))
    expect(onCancel).not.toHaveBeenCalled()
    fireEvent.click(dialog)
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('pendente: desabilita ações, mostra "Aguarde…" e ignora Esc', () => {
    const { onCancel } = setup({ pending: true })
    expect(screen.getByRole('button', { name: 'Aguarde…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Voltar' })).toBeDisabled()
    screen.getByRole('alertdialog').dispatchEvent(new Event('cancel', { cancelable: true }))
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('mantém o Tab dentro do diálogo (volta ao primeiro e ao último)', async () => {
    setup()
    const back = screen.getByRole('button', { name: 'Voltar' })
    const confirm = screen.getByRole('button', { name: 'Arquivar cliente' })
    expect(back).toHaveFocus()
    await userEvent.tab()
    expect(confirm).toHaveFocus()
    await userEvent.tab()
    expect(back).toHaveFocus()
    await userEvent.tab({ shift: true })
    expect(confirm).toHaveFocus()
  })

  it('fecha quando open vira false', () => {
    const { rerender } = render(
      <ConfirmDialog open title="t" description="d" confirmLabel="ok" onConfirm={() => {}} onCancel={() => {}} />,
    )
    const dialog = screen.getAllByRole('alertdialog')[0]
    expect(dialog).toHaveAttribute('open')
    rerender(<ConfirmDialog open={false} title="t" description="d" confirmLabel="ok" onConfirm={() => {}} onCancel={() => {}} />)
    expect(dialog).not.toHaveAttribute('open')
  })
})

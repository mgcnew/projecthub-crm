import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { DateField, DateTimeField, TimeField, type PickerFieldProps } from './DateTimeField'

function Harness({
  Component,
  initial = '',
  spy,
  label,
  props,
}: {
  Component: (p: PickerFieldProps) => React.ReactElement
  initial?: string
  spy: (v: string) => void
  label: string
  props?: Partial<PickerFieldProps>
}) {
  const [value, setValue] = useState(initial)
  return (
    <>
      <label htmlFor="f">{label}</label>
      <Component
        id="f"
        value={value}
        onChange={(v) => {
          setValue(v)
          spy(v)
        }}
        {...props}
      />
      <output data-testid="value">{value}</output>
    </>
  )
}

describe('DateField', () => {
  it('digitar uma data válida devolve o ISO e formata ao sair do campo', async () => {
    const user = userEvent.setup()
    const spy = vi.fn()
    render(<Harness Component={DateField} spy={spy} label="Prazo" />)
    const input = screen.getByLabelText('Prazo')
    await user.type(input, '15112026')
    expect(input).toHaveValue('15/11/2026')
    expect(spy).toHaveBeenLastCalledWith('2026-11-15')
    await user.tab()
    expect(input).toHaveValue('15/11/2026')
  })

  it('aceita o ISO colado (testes e colagens)', async () => {
    const user = userEvent.setup()
    const spy = vi.fn()
    render(<Harness Component={DateField} spy={spy} label="Prazo" />)
    await user.click(screen.getByLabelText('Prazo'))
    await user.paste('2026-11-15')
    expect(spy).toHaveBeenLastCalledWith('2026-11-15')
  })

  it('data que não existe vira vazio e avisa ao sair', async () => {
    const user = userEvent.setup()
    const spy = vi.fn()
    render(<Harness Component={DateField} spy={spy} label="Prazo" />)
    await user.type(screen.getByLabelText('Prazo'), '31022026')
    expect(spy).toHaveBeenLastCalledWith('')
    await user.tab()
    expect(await screen.findByRole('alert')).toHaveTextContent('Data inválida')
  })

  it('o valor externo aparece formatado', () => {
    render(<Harness Component={DateField} spy={vi.fn()} label="Prazo" initial="2026-03-05" />)
    expect(screen.getByLabelText('Prazo')).toHaveValue('05/03/2026')
  })

  it('o calendário escolhe o dia e fecha', async () => {
    const user = userEvent.setup()
    const spy = vi.fn()
    render(<Harness Component={DateField} spy={spy} label="Prazo" initial="2026-11-03" />)
    await user.click(screen.getByRole('button', { name: 'Abrir calendário' }))
    expect(screen.getByRole('grid', { name: 'novembro de 2026', hidden: true })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '20 de novembro de 2026', hidden: true }))
    expect(spy).toHaveBeenLastCalledWith('2026-11-20')
    expect(screen.getByLabelText('Prazo')).toHaveValue('20/11/2026')
    expect(screen.queryByRole('grid', { hidden: true })).toBeNull()
  })

  it('navega entre meses e limpa', async () => {
    const user = userEvent.setup()
    const spy = vi.fn()
    render(<Harness Component={DateField} spy={spy} label="Prazo" initial="2026-11-03" />)
    await user.click(screen.getByRole('button', { name: 'Abrir calendário' }))
    await user.click(screen.getByRole('button', { name: 'Próximo mês', hidden: true }))
    expect(screen.getByRole('grid', { name: 'dezembro de 2026', hidden: true })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Limpar', hidden: true }))
    expect(spy).toHaveBeenLastCalledWith('')
    expect(screen.getByLabelText('Prazo')).toHaveValue('')
  })

  it('teclado: setas e PageDown movem o dia em foco (o foco real é conferido no E2E)', async () => {
    const user = userEvent.setup()
    render(<Harness Component={DateField} spy={vi.fn()} label="Prazo" initial="2026-11-03" />)
    await user.click(screen.getByRole('button', { name: 'Abrir calendário' }))
    const tabbable = () =>
      screen
        .getAllByRole('button', { hidden: true })
        .filter((b) => b.dataset.iso && b.tabIndex === 0)
        .map((b) => b.dataset.iso)
    expect(tabbable()).toEqual(['2026-11-03'])

    const grid = screen.getByRole('grid', { name: 'novembro de 2026', hidden: true })
    const day = screen.getByRole('button', { name: '3 de novembro de 2026', hidden: true })
    fireEvent.keyDown(day, { key: 'ArrowRight' })
    expect(tabbable()).toEqual(['2026-11-04'])
    fireEvent.keyDown(grid, { key: 'ArrowDown' })
    expect(tabbable()).toEqual(['2026-11-11'])
    fireEvent.keyDown(grid, { key: 'Home' })
    expect(tabbable()).toEqual(['2026-11-08'])
    fireEvent.keyDown(grid, { key: 'End' })
    expect(tabbable()).toEqual(['2026-11-14'])
    fireEvent.keyDown(grid, { key: 'PageDown' })
    expect(screen.getByRole('grid', { name: 'dezembro de 2026', hidden: true })).toBeInTheDocument()
    expect(tabbable()).toEqual(['2026-12-14'])
  })

  it('não oferece Limpar quando clearable é falso', async () => {
    const user = userEvent.setup()
    render(<Harness Component={DateField} spy={vi.fn()} label="Prazo" props={{ clearable: false }} />)
    await user.click(screen.getByRole('button', { name: 'Abrir calendário' }))
    expect(screen.queryByRole('button', { name: 'Limpar', hidden: true })).toBeNull()
  })
})

describe('DateTimeField', () => {
  it('digitar data e hora devolve o formato do datetime-local', async () => {
    const user = userEvent.setup()
    const spy = vi.fn()
    render(<Harness Component={DateTimeField} spy={spy} label="Prazo" />)
    await user.type(screen.getByLabelText('Prazo'), '151120261430')
    expect(screen.getByLabelText('Prazo')).toHaveValue('15/11/2026 14:30')
    expect(spy).toHaveBeenLastCalledWith('2026-11-15T14:30')
  })

  it('só a data não é um valor completo', async () => {
    const user = userEvent.setup()
    const spy = vi.fn()
    render(<Harness Component={DateTimeField} spy={spy} label="Prazo" />)
    await user.type(screen.getByLabelText('Prazo'), '15112026')
    expect(spy).toHaveBeenLastCalledWith('')
  })

  it('escolher o dia assume 09:00 e escolher o horário fecha', async () => {
    const user = userEvent.setup()
    const spy = vi.fn()
    render(<Harness Component={DateTimeField} spy={spy} label="Prazo" />)
    await user.click(screen.getByRole('button', { name: 'Abrir calendário' }))
    await user.click(screen.getAllByRole('button', { name: /de .* de \d{4}$/, hidden: true })[10])
    expect(spy.mock.lastCall?.[0]).toMatch(/^\d{4}-\d{2}-\d{2}T09:00$/)
    await user.click(screen.getByRole('option', { name: '14:30', hidden: true }))
    expect(spy.mock.lastCall?.[0]).toMatch(/^\d{4}-\d{2}-\d{2}T14:30$/)
    expect(screen.queryByRole('grid', { hidden: true })).toBeNull()
  })
})

describe('TimeField', () => {
  it('normaliza 930 para 09:30 ao sair do campo', async () => {
    const user = userEvent.setup()
    const spy = vi.fn()
    render(<Harness Component={TimeField} spy={spy} label="Início" />)
    const input = screen.getByLabelText('Início')
    await user.type(input, '930')
    expect(spy).toHaveBeenLastCalledWith('09:30')
    await user.tab()
    expect(input).toHaveValue('09:30')
  })

  it('a lista escolhe o horário', async () => {
    const user = userEvent.setup()
    const spy = vi.fn()
    render(<Harness Component={TimeField} spy={spy} label="Início" />)
    await user.click(screen.getByRole('button', { name: 'Abrir horários' }))
    await user.click(screen.getByRole('option', { name: '13:15', hidden: true }))
    expect(spy).toHaveBeenLastCalledWith('13:15')
    expect(screen.getByLabelText('Início')).toHaveValue('13:15')
  })
})

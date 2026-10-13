/** Checkbox de linha com área de toque de 44px (32px a partir de 1024px) e o controle visual de 20px. */
export function RowCheckbox({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean
  onChange: () => void
  label: string
  disabled?: boolean
}) {
  return (
    <label className="flex size-11 shrink-0 cursor-pointer items-center justify-center lg:size-8">
      <input
        type="checkbox"
        className="size-5 cursor-pointer disabled:cursor-not-allowed"
        aria-label={label}
        checked={checked}
        disabled={disabled}
        onChange={onChange}
      />
    </label>
  )
}

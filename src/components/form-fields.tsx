import { useController, type Control, type FieldValues, type Path } from 'react-hook-form'
import { DateField, DateTimeField, TimeField, type PickerFieldProps } from './DateTimeField'

type Adapter<T extends FieldValues> = Omit<PickerFieldProps, 'value' | 'onChange' | 'onBlur' | 'name' | 'invalid' | 'inputRef'> & {
  control: Control<T>
  name: Path<T>
}

function make(Component: (p: PickerFieldProps) => React.ReactElement) {
  return function FormPicker<T extends FieldValues>({ control, name, ...rest }: Adapter<T>) {
    const { field, fieldState } = useController({ control, name })
    return (
      <Component
        {...rest}
        name={field.name}
        value={(field.value as string | undefined) ?? ''}
        onChange={field.onChange}
        onBlur={field.onBlur}
        inputRef={field.ref}
        invalid={Boolean(fieldState.error)}
      />
    )
  }
}

/** Adaptadores do react-hook-form para os seletores de data e hora. */
export const FormDateField = make(DateField)
export const FormDateTimeField = make(DateTimeField)
export const FormTimeField = make(TimeField)

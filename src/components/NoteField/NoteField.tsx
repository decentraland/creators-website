import { useId } from 'react'
import * as S from './NoteField.styles'

type Props = {
  label: string
  value: string
  onChange: (value: string) => void
  maxLength: number
  placeholder?: string
  disabled?: boolean
  testId?: string
}

/** A labelled free-text box with its length counter, for the messages creators and curators send each other. */
export function NoteField({ label, value, onChange, maxLength, placeholder, disabled, testId }: Props) {
  const id = useId()
  return (
    <S.Field>
      <label htmlFor={id}>{label}</label>
      <S.TextArea
        id={id}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        disabled={disabled}
        data-testid={testId}
        onChange={event => onChange(event.target.value)}
      />
      <S.CharCount>
        {value.length}/{maxLength}
      </S.CharCount>
    </S.Field>
  )
}

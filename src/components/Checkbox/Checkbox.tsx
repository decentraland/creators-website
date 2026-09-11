import { type ReactNode } from 'react'
import { Check as CheckIcon } from '@mui/icons-material'
import * as S from './Checkbox.styles'

type Props = {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  children: ReactNode
  testId: string
}

export function Checkbox({ checked, onChange, disabled, children, testId }: Props) {
  return (
    <S.CheckboxRow data-disabled={disabled || undefined} data-testid="checkbox-label">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        data-testid={testId}
        onChange={event => onChange(event.target.checked)}
      />
      <S.CheckboxBox aria-hidden>
        <CheckIcon />
      </S.CheckboxBox>
      <span>{children}</span>
    </S.CheckboxRow>
  )
}

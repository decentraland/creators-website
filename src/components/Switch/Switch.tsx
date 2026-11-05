import * as S from './Switch.styles'

type Props = {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  label: string
  testId: string
}

export function Switch({ checked, onChange, disabled, label, testId }: Props) {
  return (
    <S.Track
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      data-checked={checked || undefined}
      data-testid={testId}
      onClick={() => onChange(!checked)}
    >
      <S.Knob aria-hidden />
    </S.Track>
  )
}

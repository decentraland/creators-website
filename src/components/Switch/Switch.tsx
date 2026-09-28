import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

type Props = {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  label: string
  testId: string
}

const Track = styled.button`
  position: relative;
  flex: none;
  width: 44px;
  height: 20px;
  padding: 0;
  border: 0;
  border-radius: ${theme.radius.pill};
  background: ${theme.colors.glassHover};
  cursor: pointer;
  transition: background 0.15s ease;

  &[data-checked] {
    background: rgba(255, 45, 85, 0.5);
  }
  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
  &:focus-visible {
    outline: 2px solid ${theme.colors.glassLine};
    outline-offset: 2px;
  }
`

const Knob = styled.span`
  position: absolute;
  top: -2px;
  left: 0;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: ${theme.colors.white};
  box-shadow: 0 2px 4px ${theme.colors.overlay};
  transition:
    transform 0.15s ease,
    background 0.15s ease;

  [data-checked] > & {
    transform: translateX(20px);
    background: ${theme.colors.dclRed};
  }
`

export function Switch({ checked, onChange, disabled, label, testId }: Props) {
  return (
    <Track
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      data-checked={checked || undefined}
      data-testid={testId}
      onClick={() => onChange(!checked)}
    >
      <Knob aria-hidden />
    </Track>
  )
}

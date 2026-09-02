import { type ComponentPropsWithoutRef } from 'react'
import * as S from './Button.styles'

type Props = ComponentPropsWithoutRef<'button'> & {
  variant?: 'primary' | 'secondary'
  /** Replaces the button content with a spinner and disables it. */
  loading?: boolean
}

export function Button({ variant = 'primary', loading = false, disabled, children, ...rest }: Props) {
  return (
    <S.Root data-variant={variant} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <S.Spinner data-testid="button-spinner" aria-hidden /> : children}
    </S.Root>
  )
}

import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import * as S from './SaleButton.styles'

export type SaleButtonVariant = 'default' | 'purple' | 'red' | 'outline' | 'ghost' | 'white'

type Props = ComponentPropsWithoutRef<'button'> & { variant?: SaleButtonVariant; size?: 'md' | 'sm' }

/** The Shop's button, so this modal's actions match it exactly. */
export const SaleButton = forwardRef<HTMLButtonElement, Props>(function SaleButton(
  { variant = 'default', size = 'md', type = 'button', ...rest },
  ref
) {
  return <S.Root ref={ref} type={type} data-variant={variant} data-size={size} {...rest} />
})

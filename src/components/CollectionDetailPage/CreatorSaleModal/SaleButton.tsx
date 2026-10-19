import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import * as S from './SaleButton.styles'

export type SaleButtonVariant = 'purple' | 'red' | 'white'

type Props = ComponentPropsWithoutRef<'button'> & { variant?: SaleButtonVariant }

/** The Shop's button, so this modal's actions match it exactly. */
export const SaleButton = forwardRef<HTMLButtonElement, Props>(function SaleButton(
  { variant = 'red', type = 'button', ...rest },
  ref
) {
  return <S.Root ref={ref} type={type} data-variant={variant} {...rest} />
})

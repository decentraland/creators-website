import type { CSSProperties } from 'react'
import creditsGlyph from '~/assets/icons/credits.svg'
import manaGlyph from '~/assets/icons/mana-matic.svg'
import { Mark } from './SaleIcon.styles'

/** A currency mark, as the Shop draws it beside an amount: a mask tinted with currentColor. Credits unless told. */
export function CurrencyIcon({
  className,
  size,
  currency = 'credits'
}: {
  className?: string
  size?: number
  currency?: 'credits' | 'mana'
}) {
  const style = {
    '--icon-url': `url("${currency === 'mana' ? manaGlyph : creditsGlyph}")`,
    ...(size ? { width: size, height: size } : {})
  } as CSSProperties
  return <Mark aria-hidden className={className ? `ico ${className}` : 'ico'} style={style} />
}

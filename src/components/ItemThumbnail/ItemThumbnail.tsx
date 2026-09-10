import { type ReactNode } from 'react'
import { getRarityMediaBackground } from '~/lib/rarities'
import * as S from './ItemThumbnail.styles'

type Props = {
  src?: string | null
  rarity?: string | null
  /** Overlays (badges, hover masks) rendered over the artwork. */
  children?: ReactNode
  className?: string
  testId?: string
}

/** An item's artwork over its rarity-tinted media field; neutral when the rarity is unknown or missing. */
export function ItemThumbnail({ src, rarity, children, className, testId = 'item-thumbnail' }: Props) {
  const backgroundImage = getRarityMediaBackground(rarity)
  return (
    <S.Frame className={className} data-testid={testId} style={backgroundImage ? { backgroundImage } : undefined}>
      {src && <S.Img src={src} alt="" loading="lazy" data-testid={`${testId}-img`} />}
      {children}
    </S.Frame>
  )
}

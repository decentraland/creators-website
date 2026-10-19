import { useIntl } from 'react-intl'
import { useTranslation } from '~/intl'
import * as S from './SaleTag.styles'

type Props = {
  /** Percent off; a non-whole one shows up to two decimals in the viewer's locale. Zero falls back to the plain word. */
  pct: number
  /** 'sm' on a row or a card, 'lg' where it heads a price, the two sizes the Shop draws it at. */
  size?: 'sm' | 'lg'
  className?: string
  testId?: string
}

/** How much a discount takes off, drawn like the Shop's tag so it reads the same in both. */
export function SaleTag({ pct, size = 'sm', className, testId }: Props) {
  const { t } = useTranslation()
  const intl = useIntl()
  return (
    <S.Root className={className} data-size={size} data-testid={testId}>
      {/* Decorative: the number beside it carries the meaning. */}
      <span aria-hidden>🔥</span>
      <S.Pct>
        {pct > 0
          ? t('collection_detail_page.price.off', { pct: intl.formatNumber(pct, { maximumFractionDigits: 2 }) })
          : t('collection_detail_page.price.sale')}
      </S.Pct>
    </S.Root>
  )
}

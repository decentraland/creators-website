import { useTranslation } from '~/intl'
import * as S from './SaleTag.styles'

type Props = {
  /** Percent off, whole or not ("12.5"). */
  pct: string
  testId?: string
}

/** How much a discount takes off, drawn like the Shop's tag so it reads the same in both. */
export function SaleTag({ pct, testId }: Props) {
  const { t } = useTranslation()
  return (
    <S.Root data-testid={testId}>
      {/* Decorative: the number beside it carries the meaning. */}
      <span aria-hidden>🔥</span>
      <S.Pct>{t('collection_detail_page.price.off', { pct })}</S.Pct>
    </S.Root>
  )
}

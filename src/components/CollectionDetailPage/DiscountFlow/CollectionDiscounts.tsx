import { useIntl } from 'react-intl'
import { useTranslation } from '~/intl'
import { discountPct, isDiscountCapped, liveDiscountStatus, type CollectionDiscount } from '~/lib/coupons'
import { Button } from '~/components/Button'
import * as S from './DiscountFlow.styles'

type Props = {
  discounts: CollectionDiscount[]
  onEnd: (discount: CollectionDiscount) => void
}

/** The collection's running and scheduled discounts, each with a way to end it early. */
export function CollectionDiscounts({ discounts, onEnd }: Props) {
  const { t } = useTranslation()
  const intl = useIntl()
  if (discounts.length === 0) return null
  const date = (ms: number) => intl.formatDate(ms, { month: 'short', day: 'numeric' })
  return (
    <S.Discounts aria-label={t('collection_discount.list_label')} data-testid="collection-discounts">
      {discounts.map(discount => {
        const scheduled = liveDiscountStatus(discount) === 'scheduled'
        return (
          <S.DiscountChip
            key={discount.id}
            data-status={scheduled ? 'scheduled' : 'active'}
            data-testid="collection-discount"
          >
            <S.DiscountTerms>
              <b>{t('collection_discount.chip.off', { pct: discountPct(discount) })}</b>
              <span>
                {scheduled
                  ? t('collection_discount.chip.starts', { date: date(discount.checks.effective) })
                  : t('collection_discount.chip.ends', { date: date(discount.checks.expiration) })}
              </span>
              {isDiscountCapped(discount) && (
                <span>
                  {t('collection_discount.chip.uses', { used: discount.state?.uses ?? 0, total: discount.checks.uses })}
                </span>
              )}
              {discount.collections.length > 1 && (
                <span data-testid="discount-other-collections">
                  {t('collection_discount.chip.others', { count: discount.collections.length - 1 })}
                </span>
              )}
            </S.DiscountTerms>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              data-testid="end-discount"
              onClick={() => onEnd(discount)}
            >
              {t('collection_discount.end.action')}
            </Button>
          </S.DiscountChip>
        )
      })}
    </S.Discounts>
  )
}

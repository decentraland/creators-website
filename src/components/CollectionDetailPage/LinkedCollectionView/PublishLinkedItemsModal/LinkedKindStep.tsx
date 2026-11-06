import { ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon } from '@mui/icons-material'
import { useIntl } from 'react-intl'
import { useTranslation } from '~/intl'
import { weiToUsdCents } from '~/lib/publishFee'
import { type ThirdPartyPrice } from '~/lib/thirdPartyRegistry'
import { Button } from '~/components/Button'
import * as S from '../../PublishCollectionModal/PublishCollectionModal.styles'
import * as R from './LinkedPublishRow.styles'

type Props = {
  value: boolean
  price: ThirdPartyPrice | undefined
  priceError: boolean
  onRetryPrice: () => void
  onChange: (isProgrammatic: boolean) => void
  onBack: () => void
  onConfirm: () => void
}

/** First publish only: standard (a fee per item) or programmatic (one fee for a pack of slots, then free). */
export function LinkedKindStep({ value, price, priceError, onRetryPrice, onChange, onBack, onConfirm }: Props) {
  const { t } = useTranslation()
  const intl = useIntl()
  const usd = (wei: bigint) => intl.formatNumber(weiToUsdCents(wei) / 100, { style: 'currency', currency: 'USD' })

  return (
    <S.Step data-testid="publish-linked-kind-step">
      <S.Heading>{t('publish_linked_modal.kind_step.title')}</S.Heading>
      <S.Text>{t('publish_linked_modal.kind_step.description')}</S.Text>
      {priceError ? (
        <S.InlineNote data-testid="publish-linked-price-error">
          {t('publish_linked_modal.payment_step.price_error')}
          <Button type="button" variant="secondary" size="sm" onClick={onRetryPrice}>
            {t('publish_collection_modal.payment_step.retry')}
          </Button>
        </S.InlineNote>
      ) : (
        <R.KindCards role="radiogroup" aria-label={t('publish_linked_modal.kind_step.title')}>
          {[false, true].map(programmatic => (
            <R.KindCard
              key={String(programmatic)}
              type="button"
              role="radio"
              aria-checked={value === programmatic}
              data-selected={value === programmatic || undefined}
              data-testid={`publish-linked-kind-${programmatic ? 'programmatic' : 'standard'}`}
              onClick={() => onChange(programmatic)}
            >
              <R.KindTitle>{t(`linked_collection.kind.${programmatic ? 'programmatic' : 'standard'}`)}</R.KindTitle>
              <R.KindText>
                {t(`publish_linked_modal.kind_step.${programmatic ? 'programmatic' : 'standard'}_description`)}
              </R.KindText>
              <R.KindPrice data-testid={`publish-linked-kind-${programmatic ? 'programmatic' : 'standard'}-price`}>
                {price
                  ? programmatic
                    ? t('publish_linked_modal.kind_step.programmatic_price', {
                        price: usd(price.itemSlotUsdWei * BigInt(price.programmaticMinSlots)),
                        slots: price.programmaticMinSlots
                      })
                    : t('publish_linked_modal.kind_step.standard_price', { price: usd(price.itemSlotUsdWei) })
                  : '…'}
              </R.KindPrice>
            </R.KindCard>
          ))}
        </R.KindCards>
      )}
      <S.Footer>
        <Button type="button" variant="secondary" data-testid="publish-back" onClick={onBack}>
          <ChevronLeftIcon fontSize="small" />
          {t('publish_collection_modal.back')}
        </Button>
        <Button type="button" disabled={!price} data-testid="publish-linked-kind-confirm" onClick={onConfirm}>
          {t('publish_linked_modal.kind_step.confirm')}
          <ChevronRightIcon fontSize="small" />
        </Button>
      </S.Footer>
    </S.Step>
  )
}

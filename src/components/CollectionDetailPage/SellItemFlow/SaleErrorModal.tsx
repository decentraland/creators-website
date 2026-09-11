import errorArt from '~/assets/modal-error.png'
import { ConfirmModal } from '~/components/ConfirmModal'
import { useTranslation } from '~/intl'
import { type SellFailureReason } from '~/lib/sales'

export type SaleStage = 'enable' | 'sell' | 'remove' | 'update' | 'send'

type Props = {
  stage: SaleStage
  reason: SellFailureReason
  onCancel: () => void
  onRetry: () => void
}

// A sold-out item can't be listed no matter how many times you try.
const UNRETRIABLE_REASONS: SellFailureReason[] = ['sold_out', 'not_listed']

/** "We couldn't put your item on sale" — TRY AGAIN returns to the step that failed with everything kept. */
export function SaleErrorModal({ stage, reason, onCancel, onRetry }: Props) {
  const { t } = useTranslation()
  const canRetry = !UNRETRIABLE_REASONS.includes(reason)
  const description =
    reason === 'sold_out' || reason === 'not_listed' ? `description_${reason}` : `description_${stage}`
  return (
    <ConfirmModal
      title={t(`sell_item_modal.error.title_${stage}`)}
      description={t(`sell_item_modal.error.${description}`)}
      art={{ src: errorArt }}
      onClose={onCancel}
      cancel={{ label: t('sell_item_modal.cancel'), onClick: onCancel, testId: 'sale-error-cancel' }}
      confirm={
        canRetry
          ? { label: t('sell_item_modal.error.try_again'), onClick: onRetry, testId: 'sale-error-retry' }
          : undefined
      }
      testId="sale-error-modal"
    />
  )
}

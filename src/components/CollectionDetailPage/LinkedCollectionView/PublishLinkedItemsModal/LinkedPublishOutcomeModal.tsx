import errorArt from '~/assets/modal-error.png'
import { useTranslation } from '~/intl'
import { type LinkedPublishError, type LinkedPublishFailureReason } from '~/lib/publishLinkedItems'
import { Button } from '~/components/Button'
import { ConfirmModal } from '~/components/ConfirmModal'
import * as S from './LinkedPublishRow.styles'
import { PublishSuccessModal } from '../../PublishCollectionModal/PublishSuccessModal'

type Props = {
  outcome: 'success' | LinkedPublishError
  onClose: () => void
  onRetry: () => void
  /** Drops a payment that never confirms, for a creator who cancelled it in their wallet. */
  onForgetPayment?: () => void
}

// Reasons with their own copy; the rest share the generic one.
const DESCRIBED: LinkedPublishFailureReason[] = [
  'rejected',
  'reverted',
  'payment_pending',
  'fee_changed',
  'insufficient_slots',
  'pending_review',
  'tos_failed',
  'push_failed'
]
// Once a review is pending there is nothing to retry; a reverted transaction charged nothing and can be sent again.
const UNRETRIABLE: LinkedPublishFailureReason[] = ['pending_review']

/** The end of the linked publish wizard: sent for review, or what failed and whether to try again. */
export function LinkedPublishOutcomeModal({ outcome, onClose, onRetry, onForgetPayment }: Props) {
  const { t } = useTranslation()
  if (outcome === 'success') return <PublishSuccessModal onDone={onClose} />
  const reason = DESCRIBED.includes(outcome.reason) ? outcome.reason : 'generic'
  const canRetry = !UNRETRIABLE.includes(outcome.reason)
  return (
    <ConfirmModal
      title={t('publish_linked_modal.error.title')}
      description={t(`publish_linked_modal.error.${reason}`)}
      art={{ src: errorArt }}
      onClose={onClose}
      cancel={{ label: t('publish_collection_modal.error.cancel'), onClick: onClose, testId: 'publish-error-cancel' }}
      confirm={
        canRetry
          ? { label: t('publish_collection_modal.error.try_again'), onClick: onRetry, testId: 'publish-error-retry' }
          : undefined
      }
      testId="publish-linked-error-modal"
    >
      {outcome.reason === 'payment_pending' && onForgetPayment && (
        <S.Forget>
          <S.ForgetText>{t('publish_linked_modal.error.forget_payment_note')}</S.ForgetText>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            data-testid="publish-forget-payment"
            onClick={onForgetPayment}
          >
            {t('publish_linked_modal.error.forget_payment')}
          </Button>
        </S.Forget>
      )}
    </ConfirmModal>
  )
}

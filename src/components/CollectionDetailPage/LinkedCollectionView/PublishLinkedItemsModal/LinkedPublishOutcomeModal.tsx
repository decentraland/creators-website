import errorArt from '~/assets/modal-error.png'
import { useTranslation } from '~/intl'
import { type Collection } from '~/lib/collections'
import { type LinkedPublishError, type LinkedPublishFailureReason } from '~/lib/publishLinkedItems'
import { ConfirmModal } from '~/components/ConfirmModal'
import { PublishSuccessModal } from '../../PublishCollectionModal/PublishSuccessModal'

type Props = {
  outcome: 'success' | LinkedPublishError
  collection: Collection
  onClose: () => void
  onRetry: () => void
}

// Reasons with their own copy; the rest share the generic one.
const DESCRIBED: LinkedPublishFailureReason[] = [
  'rejected',
  'reverted',
  'insufficient_slots',
  'pending_review',
  'tos_failed'
]
// Once a review is pending there is nothing to retry; a reverted transaction charged nothing and can be sent again.
const UNRETRIABLE: LinkedPublishFailureReason[] = ['pending_review']

/** The end of the linked publish wizard: sent for review, or what failed and whether to try again. */
export function LinkedPublishOutcomeModal({ outcome, onClose, onRetry }: Props) {
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
    />
  )
}

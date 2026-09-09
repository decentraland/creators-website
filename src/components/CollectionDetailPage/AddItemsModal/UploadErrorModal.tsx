import uploadErrorArt from '~/assets/modal-error.png'
import { ConfirmModal } from '~/components/ConfirmModal'
import { useTranslation } from '~/intl'
import { type UploadFailureReason } from '~/lib/uploadItems'

type Props = {
  reason: UploadFailureReason
  onCancel: () => void
  onRetry: () => void
}

/** Upload failure feedback. Generic failures offer TRY AGAIN (reopens the details modal with the failed items). */
export function UploadErrorModal({ reason, onCancel, onRetry }: Props) {
  const { t } = useTranslation()
  // Locked/published collections can never be retried: they get a reason-specific title and a single acknowledge action.
  const canRetry = reason === 'generic'

  return (
    <ConfirmModal
      title={t(`add_items_modal.error.title_${reason}`)}
      description={t(`add_items_modal.error.description_${reason}`)}
      art={{ src: uploadErrorArt }}
      onClose={onCancel}
      cancel={
        canRetry ? { label: t('add_items_modal.cancel'), onClick: onCancel, testId: 'upload-error-cancel' } : undefined
      }
      confirm={
        canRetry
          ? { label: t('add_items_modal.error.try_again'), onClick: onRetry, testId: 'upload-error-retry' }
          : { label: t('add_items_modal.error.got_it'), onClick: onCancel, testId: 'upload-error-dismiss' }
      }
      testId="upload-error-modal"
    />
  )
}

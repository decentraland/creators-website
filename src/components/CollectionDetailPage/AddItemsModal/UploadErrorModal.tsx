import uploadErrorArt from '~/assets/upload-error.png'
import { Button } from '~/components/Button'
import { Modal } from '~/components/Modal'
import { useTranslation } from '~/intl'
import { type UploadFailureReason } from '~/lib/uploadItems'
import * as S from '../ConfirmModals.styles'

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
  const title = t(`add_items_modal.error.title_${reason}`)

  return (
    <Modal title={title} onClose={onCancel} hideTitle testId="upload-error-modal">
      <S.Wrap>
        <S.Art src={uploadErrorArt} alt="" />
        <S.Heading data-testid="upload-error-title">{title}</S.Heading>
        <S.Text data-testid="upload-error-description">{t(`add_items_modal.error.description_${reason}`)}</S.Text>
        <S.Actions>
          {canRetry ? (
            <>
              <Button type="button" variant="secondary" data-testid="upload-error-cancel" onClick={onCancel}>
                {t('add_items_modal.cancel')}
              </Button>
              <Button type="button" variant="primary" data-testid="upload-error-retry" onClick={onRetry}>
                {t('add_items_modal.error.try_again')}
              </Button>
            </>
          ) : (
            <Button type="button" variant="primary" data-testid="upload-error-dismiss" onClick={onCancel}>
              {t('add_items_modal.error.got_it')}
            </Button>
          )}
        </S.Actions>
      </S.Wrap>
    </Modal>
  )
}

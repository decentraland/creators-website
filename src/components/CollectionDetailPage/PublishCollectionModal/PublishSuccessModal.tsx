import { Check as CheckIcon } from '@mui/icons-material'
import { Modal } from '~/components/Modal'
import { Button } from '~/components/Button'
import { useTranslation } from '~/intl'
import successArt from '~/assets/publish-success.png'
import * as S from './PublishSuccessModal.styles'

type Props = {
  onDone: () => void
}

/** Shown once the publish transaction is sent: the collection is now with the curators. */
export function PublishSuccessModal({ onDone }: Props) {
  const { t } = useTranslation()
  return (
    <Modal
      title={t('publish_collection_modal.success.title')}
      onClose={onDone}
      hideTitle
      testId="publish-success-modal"
    >
      <S.Wrap>
        <S.Art src={successArt} alt="" />
        <S.Text data-testid="publish-success-description">{t('publish_collection_modal.success.description')}</S.Text>
        <Button type="button" data-testid="publish-success-done" onClick={onDone}>
          {t('publish_collection_modal.success.done')}
          <CheckIcon fontSize="small" />
        </Button>
      </S.Wrap>
    </Modal>
  )
}

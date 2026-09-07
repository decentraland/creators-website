import { Button } from '~/components/Button'
import { WarningIcon } from '~/components/Icons'
import { Modal } from '~/components/Modal'
import { useTranslation } from '~/intl'
import * as S from '../ConfirmModals.styles'

type Props = {
  name: string
  isDeleting: boolean
  onConfirm: () => void
  onClose: () => void
}

export function DeleteCollectionModal({ name, isDeleting, onConfirm, onClose }: Props) {
  const { t } = useTranslation()
  return (
    <Modal
      title={t('collection_detail_page.actions.delete_modal.title')}
      onClose={onClose}
      closeDisabled={isDeleting}
      hideTitle
      testId="delete-collection-modal"
    >
      <S.Wrap>
        <S.IconWrap data-variant="error" aria-hidden>
          <WarningIcon />
        </S.IconWrap>
        <S.Heading>{t('collection_detail_page.actions.delete_modal.title')}</S.Heading>
        <S.Text data-testid="delete-collection-description">
          {t('collection_detail_page.actions.delete_modal.description', { name })}
        </S.Text>
        <S.Actions>
          <Button
            type="button"
            variant="secondary"
            data-testid="delete-collection-cancel"
            disabled={isDeleting}
            onClick={onClose}
          >
            {t('collection_detail_page.actions.delete_modal.cancel')}
          </Button>
          <Button type="button" data-testid="delete-collection-confirm" loading={isDeleting} onClick={onConfirm}>
            {t('collection_detail_page.actions.delete_modal.confirm')}
          </Button>
        </S.Actions>
      </S.Wrap>
    </Modal>
  )
}

import { Button } from '~/components/Button'
import { WarningIcon } from '~/components/Icons'
import { Modal } from '~/components/Modal'
import { useTranslation } from '~/intl'
import * as S from './ConfirmModals.styles'

type Props = {
  /** With reviewed items, offer to save them; with none, collapse to a simple discard confirm. */
  hasCheckedDrafts: boolean
  isSaving: boolean
  onLeave: () => void
  onSaveChanges: () => void
  onStay: () => void
}

export function LeaveConfirmModal({ hasCheckedDrafts, isSaving, onLeave, onSaveChanges, onStay }: Props) {
  const { t } = useTranslation()
  const variant = hasCheckedDrafts ? 'save' : 'discard'

  return (
    <Modal
      title={t(`add_items_modal.leave.${variant}_title`)}
      onClose={onStay}
      closeDisabled={isSaving}
      hideTitle
      testId="leave-confirm-modal"
    >
      <S.Wrap>
        <S.IconWrap aria-hidden>
          <WarningIcon />
        </S.IconWrap>
        <S.Heading>{t(`add_items_modal.leave.${variant}_title`)}</S.Heading>
        <S.Text data-testid="leave-confirm-description">{t(`add_items_modal.leave.${variant}_description`)}</S.Text>
        <S.Actions>
          <Button
            type="button"
            variant="secondary"
            data-testid="leave-without-saving"
            disabled={isSaving}
            onClick={onLeave}
          >
            {t('add_items_modal.leave.leave_without_saving')}
          </Button>
          {hasCheckedDrafts ? (
            <Button
              type="button"
              variant="primary"
              data-testid="save-changes"
              disabled={isSaving}
              onClick={onSaveChanges}
            >
              {t('add_items_modal.leave.save_changes')}
            </Button>
          ) : (
            <Button type="button" variant="primary" data-testid="keep-editing" disabled={isSaving} onClick={onStay}>
              {t('add_items_modal.leave.keep_editing')}
            </Button>
          )}
        </S.Actions>
      </S.Wrap>
    </Modal>
  )
}

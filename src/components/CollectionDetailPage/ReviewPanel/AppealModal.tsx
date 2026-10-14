import { useState } from 'react'
import { useTranslation } from '~/intl'
import { Button } from '~/components/Button'
import { Modal } from '~/components/Modal'
import { useAppealCuration } from '~/hooks/useCollectionEvents'
import { BuilderServerError, VALIDATION_RUNNING_STATUS } from '~/lib/builder'
import { type Collection } from '~/lib/collections'
import { useNotifications } from '~/lib/notifications'
import * as S from './AppealModal.styles'

export const APPEAL_NOTE_MAX_LENGTH = 1000

type Props = {
  collection: Collection
  address: string
  onClose: () => void
}

/** The creator's "Request human review": a required note for the curators, then the appeal request. */
export function AppealModal({ collection, address, onClose }: Props) {
  const { t } = useTranslation()
  const showToast = useNotifications(state => state.showToast)
  const appeal = useAppealCuration(address)
  const [note, setNote] = useState('')
  const trimmed = note.trim()

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!trimmed) return
    appeal.mutate(
      { collection, note: trimmed },
      {
        onSuccess: () => {
          showToast(t('appeal_modal.success'))
          onClose()
        }
      }
    )
  }

  const errorKey =
    appeal.error instanceof BuilderServerError && appeal.error.status === VALIDATION_RUNNING_STATUS
      ? 'appeal_modal.already_open'
      : 'appeal_modal.error'

  return (
    <Modal
      title={t('appeal_modal.title')}
      onClose={onClose}
      closeDisabled={appeal.isPending}
      compact
      testId="appeal-modal"
    >
      <S.Form onSubmit={submit}>
        <S.Text>{t('appeal_modal.description')}</S.Text>
        <S.Field>
          <label htmlFor="appeal-note">{t('appeal_modal.note')}</label>
          <S.TextArea
            id="appeal-note"
            value={note}
            maxLength={APPEAL_NOTE_MAX_LENGTH}
            placeholder={t('appeal_modal.note_placeholder')}
            disabled={appeal.isPending}
            data-testid="appeal-note"
            onChange={event => setNote(event.target.value)}
          />
          <S.CharCount>
            {note.length}/{APPEAL_NOTE_MAX_LENGTH}
          </S.CharCount>
        </S.Field>
        {appeal.isError && <S.Error data-testid="appeal-error">{t(errorKey)}</S.Error>}
        <S.Actions>
          <Button type="button" variant="secondary" disabled={appeal.isPending} onClick={onClose}>
            {t('appeal_modal.cancel')}
          </Button>
          <Button type="submit" loading={appeal.isPending} disabled={!trimmed} data-testid="appeal-submit">
            {t('appeal_modal.submit')}
          </Button>
        </S.Actions>
      </S.Form>
    </Modal>
  )
}

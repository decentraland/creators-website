import { useState } from 'react'
import { ChevronRight as ChevronRightIcon } from '@mui/icons-material'
import { useTranslation } from '~/intl'
import { COLLECTION_NAME_MAX_LENGTH, NAME_ALREADY_IN_USE_ERROR, validateCollectionName } from '~/lib/collections'
import { Modal } from '~/components/Modal'
import * as S from './CollectionNameModal.styles'

type Props = {
  variant: 'create' | 'rename'
  initialName?: string
  isPending: boolean
  /** Raw error message from the failed save, mapped to friendly copy here. */
  error: string | null
  onSubmit: (name: string) => void
  onClose: () => void
}

/** The New Collection / Rename Collection dialog: one validated name field. */
export function CollectionNameModal({ variant, initialName = '', isPending, error, onSubmit, onClose }: Props) {
  const { t } = useTranslation()
  const [name, setName] = useState(initialName)
  const [localError, setLocalError] = useState<string | null>(null)
  // Hides a stale server error once the user starts typing a different name.
  const [editedSinceSubmit, setEditedSinceSubmit] = useState(false)

  const trimmed = name.trim()

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!trimmed || isPending) return
    if (validateCollectionName(trimmed)) {
      // Only invalid_character can survive here: empty is blocked above, length by maxLength.
      setLocalError(t('collection_name_modal.error_invalid_character'))
      return
    }
    setLocalError(null)
    setEditedSinceSubmit(false)
    onSubmit(trimmed)
  }

  const serverError =
    error && !editedSinceSubmit
      ? error === NAME_ALREADY_IN_USE_ERROR
        ? t('collection_name_modal.error_name_taken')
        : t('collection_name_modal.error_generic', { variant })
      : null
  const shownError = localError ?? serverError

  return (
    <Modal
      title={t('collection_name_modal.title', { variant })}
      onClose={onClose}
      closeDisabled={isPending}
      testId="collection-name-modal"
    >
      <S.Form onSubmit={handleSubmit}>
        <S.Intro>
          <S.Heading>{t('collection_name_modal.heading', { variant })}</S.Heading>
          <S.Subtitle>{t('collection_name_modal.subtitle')}</S.Subtitle>
        </S.Intro>
        <div>
          <S.FieldLabel>
            {t('collection_name_modal.name_label')}
            <S.FieldBox data-invalid={shownError ? true : undefined}>
              <input
                value={name}
                placeholder={t('collection_name_modal.name_placeholder')}
                maxLength={COLLECTION_NAME_MAX_LENGTH}
                autoFocus
                data-testid="collection-name-input"
                onChange={event => {
                  setName(event.target.value)
                  setLocalError(null)
                  setEditedSinceSubmit(true)
                }}
              />
              <S.CharCount data-testid="collection-name-count">
                {t('collection_name_modal.char_count', { count: name.length, max: COLLECTION_NAME_MAX_LENGTH })}
              </S.CharCount>
            </S.FieldBox>
          </S.FieldLabel>
          {shownError && <S.ErrorText data-testid="collection-name-error">{shownError}</S.ErrorText>}
        </div>
        <S.Actions>
          <S.ActionButton
            type="button"
            data-variant="secondary"
            data-testid="collection-name-cancel"
            disabled={isPending}
            onClick={onClose}
          >
            {t('collection_name_modal.cancel')}
          </S.ActionButton>
          <S.ActionButton
            type="submit"
            data-variant="primary"
            data-testid="collection-name-submit"
            disabled={!trimmed || isPending}
          >
            {t('collection_name_modal.submit', { variant })}
            <ChevronRightIcon fontSize="small" />
          </S.ActionButton>
        </S.Actions>
      </S.Form>
    </Modal>
  )
}

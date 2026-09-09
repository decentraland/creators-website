import { useState } from 'react'
import { ChevronRight as ChevronRightIcon } from '@mui/icons-material'
import { useTranslation } from '~/intl'
import { NAME_ALREADY_IN_USE_ERROR, validateCollectionName } from '~/lib/collections'
import { Button } from '~/components/Button'
import { CollectionNameInput } from '~/components/CollectionNameInput'
import { Checkbox } from './Checkbox'
import * as S from './PublishCollectionModal.styles'

type Props = {
  initialName: string
  isSaving: boolean
  /** Raw error message from a failed rename, mapped to friendly copy here. */
  saveError: string | null
  onCancel: () => void
  onConfirm: (name: string) => void
}

/** Step 1: the creator fixes typos in the name and acknowledges it can't change after publishing. */
export function ConfirmNameStep({ initialName, isSaving, saveError, onCancel, onConfirm }: Props) {
  const { t } = useTranslation()
  const [name, setName] = useState(initialName)
  const [accepted, setAccepted] = useState(false)
  const [editedSinceSubmit, setEditedSinceSubmit] = useState(false)

  const trimmed = name.trim()
  const validation = validateCollectionName(trimmed)
  const localError = trimmed && validation ? t('publish_collection_modal.name_step.invalid_name') : null
  const serverError =
    saveError && !editedSinceSubmit
      ? saveError === NAME_ALREADY_IN_USE_ERROR
        ? t('publish_collection_modal.name_step.name_taken')
        : t('publish_collection_modal.name_step.save_error')
      : null
  const shownError = localError ?? serverError
  const canContinue = accepted && !validation && !isSaving

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!canContinue) return
    setEditedSinceSubmit(false)
    onConfirm(trimmed)
  }

  return (
    <S.Step as="form" onSubmit={handleSubmit} data-testid="publish-name-step">
      <S.Heading>{t('publish_collection_modal.name_step.title')}</S.Heading>
      <S.Text>
        {t('publish_collection_modal.name_step.description')}
        <br />
        {t('publish_collection_modal.name_step.description_2')}
      </S.Text>
      <S.InputWrapper>
        <CollectionNameInput
          value={name}
          error={shownError}
          disabled={isSaving}
          testId="publish-name"
          onChange={value => {
            setName(value)
            setEditedSinceSubmit(true)
          }}
        />
      </S.InputWrapper>
      <Checkbox checked={accepted} disabled={isSaving} onChange={setAccepted} testId="publish-name-accept">
        {t('publish_collection_modal.name_step.checkbox', { name: trimmed || initialName })}
      </Checkbox>
      <S.Footer>
        <Button type="button" variant="secondary" disabled={isSaving} data-testid="publish-cancel" onClick={onCancel}>
          {t('publish_collection_modal.cancel')}
        </Button>
        <Button type="submit" loading={isSaving} disabled={!canContinue} data-testid="publish-name-confirm">
          {t('publish_collection_modal.name_step.confirm')}
          <ChevronRightIcon fontSize="small" />
        </Button>
      </S.Footer>
    </S.Step>
  )
}

import { useId, useState } from 'react'
import { ChevronRight as ChevronRightIcon } from '@mui/icons-material'
import { useTranslation } from '~/intl'
import { NAME_ALREADY_IN_USE_ERROR, validateCollectionName } from '~/lib/collections'
import { EMAIL_MAX_LENGTH, isValidEmail } from '~/lib/email'
import { Button } from '~/components/Button'
import { CollectionNameInput } from '~/components/CollectionNameInput'
import { Checkbox } from '~/components/Checkbox'
import * as S from './PublishCollectionModal.styles'

type Props = {
  initialName: string
  /** The email already confirmed in this wizard, else the profile email; empty when there is neither. */
  initialEmail: string
  isSaving: boolean
  /** Raw error message from a failed rename, mapped to friendly copy here. */
  saveError: string | null
  onCancel: () => void
  onConfirm: (details: { name: string; email: string }) => void
}

/** Step 1: the creator fixes typos in the name, leaves a contact email and acknowledges the name is final. */
export function ConfirmNameStep({ initialName, initialEmail, isSaving, saveError, onCancel, onConfirm }: Props) {
  const { t } = useTranslation()
  const emailErrorId = useId()
  const [name, setName] = useState(initialName)
  const [email, setEmail] = useState(initialEmail)
  const [emailBlurred, setEmailBlurred] = useState(false)
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
  const trimmedEmail = email.trim()
  const emailValid = isValidEmail(trimmedEmail)
  // Judged once the creator leaves the field, so typing isn't interrupted mid-address.
  const showEmailError = emailBlurred && !!trimmedEmail && !emailValid
  const canContinue = accepted && emailValid && !validation && !isSaving && !serverError

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!canContinue) return
    setEditedSinceSubmit(false)
    onConfirm({ name: trimmed, email: trimmedEmail })
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
        <S.EmailField>
          {t('publish_collection_modal.name_step.email_label')}
          <S.EmailInput
            type="text"
            inputMode="email"
            spellCheck={false}
            autoComplete="email"
            maxLength={EMAIL_MAX_LENGTH}
            aria-required
            value={email}
            placeholder={t('publish_collection_modal.name_step.email_placeholder')}
            disabled={isSaving}
            aria-invalid={showEmailError}
            aria-describedby={showEmailError ? emailErrorId : undefined}
            data-invalid={showEmailError ? true : undefined}
            data-testid="publish-email-input"
            onChange={event => setEmail(event.target.value)}
            onFocus={() => setEmailBlurred(false)}
            onBlur={() => setEmailBlurred(true)}
          />
          {showEmailError && (
            <S.ErrorText id={emailErrorId} role="alert" data-testid="publish-email-error">
              {t('publish_collection_modal.name_step.invalid_email')}
            </S.ErrorText>
          )}
        </S.EmailField>
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

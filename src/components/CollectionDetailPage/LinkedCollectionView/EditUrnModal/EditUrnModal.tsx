import { useId, useState } from 'react'
import { useTranslation } from '~/intl'
import { isValidUrnSuffix } from '~/lib/thirdParty'
import { Button } from '~/components/Button'
import { Modal } from '~/components/Modal'
import * as N from '~/components/CollectionNameInput/CollectionNameInput.styles'
import * as S from './EditUrnModal.styles'

type Props = {
  /** Which URN is edited; only the copy changes. */
  kind: 'collection' | 'item'
  /** Everything before the editable last segment, without the trailing colon. */
  urnPrefix: string
  initialSuffix: string
  isPending: boolean
  /** Friendly error copy for the failed save. */
  error: string | null
  onSubmit: (suffix: string) => void
  onClose: () => void
}

/** Edits the last segment of a linked collection's or item's URN, with the whole URN previewed as it is typed. */
export function EditUrnModal({ kind, urnPrefix, initialSuffix, isPending, error, onSubmit, onClose }: Props) {
  const { t } = useTranslation()
  const [suffix, setSuffix] = useState(initialSuffix)
  const [edited, setEdited] = useState(false)
  const trimmed = suffix.trim()
  const isValid = isValidUrnSuffix(trimmed)
  const canSubmit = isValid && trimmed !== initialSuffix && !isPending

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!canSubmit) return
    setEdited(false)
    onSubmit(trimmed)
  }

  const errorId = useId()
  const shownError = trimmed && !isValid ? t('edit_urn_modal.error_invalid') : !edited && error ? error : null

  return (
    <Modal
      title={t(`edit_urn_modal.title.${kind}`)}
      onClose={onClose}
      closeDisabled={isPending}
      testId="edit-urn-modal"
    >
      <S.Form onSubmit={handleSubmit}>
        <S.Intro>
          <S.Heading>{t(`edit_urn_modal.heading.${kind}`)}</S.Heading>
          <S.Subtitle>{t(`edit_urn_modal.subtitle.${kind}`)}</S.Subtitle>
        </S.Intro>
        <N.Field>
          <N.Label>
            {t('edit_urn_modal.label')}
            <N.Box data-invalid={shownError ? true : undefined}>
              <input
                value={suffix}
                autoFocus
                spellCheck={false}
                autoComplete="off"
                aria-invalid={shownError ? true : undefined}
                aria-describedby={shownError ? errorId : undefined}
                data-testid="urn-suffix-input"
                onChange={event => {
                  setSuffix(event.target.value)
                  setEdited(true)
                }}
              />
            </N.Box>
          </N.Label>
          {shownError ? (
            <N.ErrorText id={errorId} data-testid="urn-suffix-error">
              {shownError}
            </N.ErrorText>
          ) : (
            <S.Preview data-testid="urn-preview" title={`${urnPrefix}:${trimmed}`}>
              {urnPrefix}:<strong>{trimmed || '…'}</strong>
            </S.Preview>
          )}
        </N.Field>
        <S.Actions>
          <Button type="button" variant="secondary" data-testid="urn-cancel" disabled={isPending} onClick={onClose}>
            {t('collection_name_modal.cancel')}
          </Button>
          <Button type="submit" data-testid="urn-submit" loading={isPending} disabled={!canSubmit}>
            {t('edit_urn_modal.submit')}
          </Button>
        </S.Actions>
      </S.Form>
    </Modal>
  )
}

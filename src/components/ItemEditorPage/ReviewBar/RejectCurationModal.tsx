import { useMemo, useState } from 'react'
import { useTranslation } from '~/intl'
import { Button } from '~/components/Button'
import { Checkbox } from '~/components/Checkbox'
import { Modal } from '~/components/Modal'
import { useRejectCuration } from '~/hooks/useCuration'
import { type Collection } from '~/lib/collections'
import { type CollectionCuration } from '~/lib/curation'
import { REJECT_REASON_CODES, type RejectReasonCode } from '~/lib/events'
import { useNotifications } from '~/lib/notifications'
import * as S from './RejectCurationModal.styles'

export const REJECTION_MESSAGE_MAX_LENGTH = 1000

type Props = {
  collection: Collection
  curation: CollectionCuration | null
  address: string
  onClose: () => void
}

/** The committee's rejection: one or more fixed reasons plus a message, both required, both shown to the creator. */
export function RejectCurationModal({ collection, curation, address, onClose }: Props) {
  const { t } = useTranslation()
  const showToast = useNotifications(state => state.showToast)
  const reject = useRejectCuration(address)
  const [reasons, setReasons] = useState<RejectReasonCode[]>([])
  const [message, setMessage] = useState('')
  const selected = useMemo(() => new Set(reasons), [reasons])
  const trimmed = message.trim()
  const canSubmit = reasons.length > 0 && trimmed.length > 0

  function toggle(code: RejectReasonCode, checked: boolean) {
    setReasons(current => (checked ? [...current, code] : current.filter(reason => reason !== code)))
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!canSubmit) return
    reject.mutate(
      { collection, curation, decision: { rejectionReasons: reasons, rejectionMessage: trimmed } },
      {
        onSuccess: () => {
          showToast(t('reject_curation_modal.success', { collection: collection.name }))
          onClose()
        }
      }
    )
  }

  return (
    <Modal
      title={t('reject_curation_modal.title', { collection: collection.name })}
      onClose={onClose}
      closeDisabled={reject.isPending}
      testId="reject-curation-modal"
    >
      <S.Form onSubmit={submit}>
        <S.Text>{t(collection.isApproved ? 'reject_curation_modal.changes' : 'reject_curation_modal.first')}</S.Text>
        <S.Fieldset>
          <S.Legend>
            {t('reject_curation_modal.reasons')}
            <S.Hint>{t('reject_curation_modal.reasons_hint')}</S.Hint>
          </S.Legend>
          <S.Reasons data-testid="reject-reasons">
            {REJECT_REASON_CODES.map(code => (
              <Checkbox
                key={code}
                checked={selected.has(code)}
                disabled={reject.isPending}
                onChange={checked => toggle(code, checked)}
                testId={`reject-reason-${code}`}
              >
                {t(`reject_reason.${code}`)}
              </Checkbox>
            ))}
          </S.Reasons>
        </S.Fieldset>
        <S.Field>
          <label htmlFor="rejection-message">{t('reject_curation_modal.message')}</label>
          <S.TextArea
            id="rejection-message"
            value={message}
            maxLength={REJECTION_MESSAGE_MAX_LENGTH}
            placeholder={t('reject_curation_modal.message_placeholder')}
            disabled={reject.isPending}
            data-testid="rejection-message"
            onChange={event => setMessage(event.target.value)}
          />
          <S.CharCount>
            {message.length}/{REJECTION_MESSAGE_MAX_LENGTH}
          </S.CharCount>
        </S.Field>
        {reject.isError && <S.Error data-testid="reject-curation-error">{t('reject_curation_modal.error')}</S.Error>}
        <S.Actions>
          <Button
            type="button"
            variant="secondary"
            disabled={reject.isPending}
            onClick={onClose}
            data-testid="reject-curation-cancel"
          >
            {t('reject_curation_modal.cancel')}
          </Button>
          <Button type="submit" loading={reject.isPending} disabled={!canSubmit} data-testid="reject-curation-confirm">
            {t('reject_curation_modal.confirm')}
          </Button>
        </S.Actions>
      </S.Form>
    </Modal>
  )
}

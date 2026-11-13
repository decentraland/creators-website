import { useMemo, useState } from 'react'
import { Close as RemoveIcon } from '@mui/icons-material'
import { useTranslation } from '~/intl'
import { Button } from '~/components/Button'
import { Modal } from '~/components/Modal'
import { MultiSelect } from '~/components/MultiSelect'
import { useRejectCuration } from '~/hooks/useCuration'
import { type Collection } from '~/lib/collections'
import { type CollectionCuration } from '~/lib/curation'
import { REJECT_REASON_CODES, type RejectReasonCode } from '~/lib/events'
import { useNotifications } from '~/lib/notifications'
import * as S from './RejectCurationModal.styles'

export const REJECTION_MESSAGE_MAX_LENGTH = 3000

type Props = {
  collection: Collection
  curation: CollectionCuration | null
  address: string
  onClose: () => void
  /** After the rejection is saved, once the modal closed. */
  onRejected?: () => void
}

/** The committee's rejection: one or more fixed reasons, required, plus optional details, both shown to the creator. */
export function RejectCurationModal({ collection, curation, address, onClose, onRejected }: Props) {
  const { t } = useTranslation()
  const showToast = useNotifications(state => state.showToast)
  const reject = useRejectCuration(address)
  const [reasons, setReasons] = useState<RejectReasonCode[]>([])
  const [message, setMessage] = useState('')
  const options = useMemo(
    () => REJECT_REASON_CODES.map(code => ({ value: code, label: t(`reject_reason.${code}`) })),
    [t]
  )
  const trimmed = message.trim()
  const canSubmit = reasons.length > 0

  function remove(code: RejectReasonCode) {
    setReasons(current => current.filter(reason => reason !== code))
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!canSubmit) return
    reject.mutate(
      {
        collection,
        curation,
        decision: { rejectionReasons: reasons, ...(trimmed ? { rejectionMessage: trimmed } : {}) }
      },
      {
        onSuccess: () => {
          showToast(t('reject_curation_modal.success', { collection: collection.name }))
          onClose()
          onRejected?.()
        }
      }
    )
  }

  return (
    <Modal
      title={t('reject_curation_modal.title')}
      onClose={onClose}
      closeDisabled={reject.isPending}
      testId="reject-curation-modal"
    >
      <S.Form onSubmit={submit}>
        <S.Heading>{t('reject_curation_modal.heading')}</S.Heading>
        <S.Field>
          <S.Label id="reject-reasons-label">{t('reject_curation_modal.reasons')}</S.Label>
          <MultiSelect<RejectReasonCode>
            values={reasons}
            options={options}
            onChange={setReasons}
            placeholder={t('reject_curation_modal.reasons_placeholder')}
            summary={t('reject_curation_modal.reasons_selected', { count: reasons.length })}
            disabled={reject.isPending}
            ariaLabel={t('reject_curation_modal.reasons')}
            testId="reject-reasons"
          />
          {reasons.length > 0 && (
            <S.Pills data-testid="reject-reason-pills">
              {reasons.map(code => (
                <S.Pill key={code} data-testid={`reject-reason-pill-${code}`}>
                  {t(`reject_reason.${code}`)}
                  <S.PillRemove
                    type="button"
                    aria-label={t('reject_curation_modal.remove_reason', { reason: t(`reject_reason.${code}`) })}
                    disabled={reject.isPending}
                    data-testid={`reject-reason-pill-${code}-remove`}
                    onClick={() => remove(code)}
                  >
                    <RemoveIcon fontSize="inherit" />
                  </S.PillRemove>
                </S.Pill>
              ))}
            </S.Pills>
          )}
        </S.Field>
        <S.Details>
          <S.DetailsLegend>{t('reject_curation_modal.message')}</S.DetailsLegend>
          <S.TextArea
            value={message}
            maxLength={REJECTION_MESSAGE_MAX_LENGTH}
            placeholder={t('reject_curation_modal.message_placeholder')}
            aria-label={t('reject_curation_modal.message')}
            disabled={reject.isPending}
            data-testid="rejection-message"
            onChange={event => setMessage(event.target.value)}
          />
        </S.Details>
        <S.CharCount>
          {message.length}/{REJECTION_MESSAGE_MAX_LENGTH}
        </S.CharCount>
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

import { Modal } from '~/components/Modal'
import { StepIndicator } from '~/components/StepIndicator'
import { useTranslation } from '~/intl'
import * as S from './PendingModal.styles'

type Props = {
  label: string
  /** A multi-signature action shows its heading and a stepper above the spinner. */
  title?: string
  steps?: { labels: string[]; current: number }
  /** Offered only while the wallet prompt is still open: once signed, the action can't be taken back. */
  onCancel?: () => void
  testId: string
}

/** A whole-dialog spinner with one line of status copy, for wallet confirmations and pending transactions. */
export function PendingModal({ label, title, steps, onCancel, testId }: Props) {
  const { t } = useTranslation()
  return (
    <Modal title={title ?? label} onClose={() => undefined} closeDisabled hideTitle testId={testId}>
      <S.Wrap role="status" aria-live="polite" data-with-steps={steps ? '' : undefined}>
        {title && <S.Title>{title}</S.Title>}
        {steps && (
          <S.Stepper>
            <StepIndicator
              current={steps.current}
              total={steps.labels.length}
              labels={steps.labels}
              testId={`${testId}-step`}
            />
          </S.Stepper>
        )}
        <S.BigSpinner aria-hidden />
        <S.Label data-testid={`${testId}-label`}>{label}</S.Label>
        {onCancel && (
          <S.CancelLink type="button" data-testid={`${testId}-cancel`} onClick={onCancel}>
            {t('sell_item_modal.cancel')}
          </S.CancelLink>
        )}
      </S.Wrap>
    </Modal>
  )
}

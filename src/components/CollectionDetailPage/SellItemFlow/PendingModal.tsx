import { Modal } from '~/components/Modal'
import * as S from './PendingModal.styles'

type Props = {
  label: string
  /** Offered only while the wallet prompt is still open: once signed, the action can't be taken back. */
  onCancel?: () => void
  cancelLabel: string
  testId: string
}

/** A whole-dialog spinner with one line of status copy, for wallet confirmations and pending transactions. */
export function PendingModal({ label, onCancel, cancelLabel, testId }: Props) {
  return (
    <Modal title={label} onClose={() => undefined} closeDisabled hideTitle testId={testId}>
      <S.Wrap role="status" aria-live="polite">
        <S.BigSpinner aria-hidden />
        <S.Label data-testid={`${testId}-label`}>{label}</S.Label>
        {onCancel && (
          <S.CancelLink type="button" data-testid={`${testId}-cancel`} onClick={onCancel}>
            {cancelLabel}
          </S.CancelLink>
        )}
      </S.Wrap>
    </Modal>
  )
}

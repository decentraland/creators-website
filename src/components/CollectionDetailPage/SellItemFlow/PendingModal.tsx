import { Check as CheckIcon } from '@mui/icons-material'
import { Modal } from '~/components/Modal'
import { useTranslation } from '~/intl'
import * as S from './PendingModal.styles'

export type PendingStep = { label: string; state: 'done' | 'current' | 'todo' }

type Props = {
  label: string
  /** A multi-signature action shows its heading and the steps above the spinner. */
  title?: string
  steps?: PendingStep[]
  /** Secondary line under the status, e.g. how long a wait has been going on. */
  note?: string
  /** Offered only while the wallet prompt is still open: once signed, the action can't be taken back. */
  onCancel?: () => void
  testId: string
}

/** A whole-dialog spinner with one line of status copy, for wallet confirmations and pending transactions. */
export function PendingModal({ label, title, steps, note, onCancel, testId }: Props) {
  const { t } = useTranslation()
  return (
    <Modal title={title ?? label} onClose={() => undefined} closeDisabled hideTitle testId={testId}>
      <S.Wrap role="status" aria-live="polite" data-with-steps={steps ? '' : undefined}>
        {title && <S.Title>{title}</S.Title>}
        {steps && (
          <S.Steps data-testid={`${testId}-steps`}>
            {steps.map(step => (
              <S.StepItem key={step.label} data-state={step.state}>
                <S.StepDot aria-hidden>{step.state === 'done' && <CheckIcon />}</S.StepDot>
                {step.label}
              </S.StepItem>
            ))}
          </S.Steps>
        )}
        <S.BigSpinner aria-hidden />
        <S.Label data-testid={`${testId}-label`}>{label}</S.Label>
        {note && <S.Note data-testid={`${testId}-note`}>{note}</S.Note>}
        {onCancel && (
          <S.CancelLink type="button" data-testid={`${testId}-cancel`} onClick={onCancel}>
            {t('sell_item_modal.cancel')}
          </S.CancelLink>
        )}
      </S.Wrap>
    </Modal>
  )
}

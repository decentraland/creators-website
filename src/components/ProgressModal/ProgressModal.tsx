import { Modal } from '~/components/Modal'
import * as S from './ProgressModal.styles'

type Props = {
  title: string
  heading: string
  description: string
  /** The line above the bar, e.g. "Uploading files…". */
  label: string
  done: number
  total: number
  /** Without it the work can't be interrupted: no ✕, Escape or scrim close. */
  onClose?: () => void
  testId: string
}

/** A step that runs on its own: heading, copy and a counted progress bar. */
export function ProgressModal({ title, heading, description, label, done, total, onClose, testId }: Props) {
  return (
    <Modal
      title={title}
      onClose={onClose ?? (() => undefined)}
      closeDisabled={!onClose}
      hideClose={!onClose}
      testId={testId}
    >
      <S.Wrap role="status" aria-live="polite">
        <S.Heading>{heading}</S.Heading>
        <S.Description>{description}</S.Description>
        <S.Label>{label}</S.Label>
        <S.Row>
          <S.Bar value={done} max={total} aria-label={label} data-testid={`${testId}-bar`} />
          <S.Count data-testid={`${testId}-count`}>
            {done}/{total}
          </S.Count>
        </S.Row>
      </S.Wrap>
    </Modal>
  )
}

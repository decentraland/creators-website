import { Button } from '~/components/Button'
import { WarningIcon } from '~/components/Icons'
import { Modal } from '~/components/Modal'
import * as S from './ConfirmModal.styles'

type Action = {
  label: string
  onClick: () => void
  testId: string
}

type Props = {
  title: string
  description: string
  /** Illustration shown instead of the warning glyph. */
  art?: { src: string }
  /** Failure copy shown under the description after a rejected confirm. */
  error?: string | null
  /** While the confirm action is in flight: blocks closing, disables cancel, spins the confirm button. */
  busy?: boolean
  showClose?: boolean
  onClose: () => void
  cancel?: Action
  confirm?: Action
  testId: string
}

/** Centered dialog with a glyph or illustration, a heading, copy and up to two footer actions. */
export function ConfirmModal({
  title,
  description,
  art,
  error,
  busy = false,
  showClose = false,
  onClose,
  cancel,
  confirm,
  testId
}: Props) {
  return (
    <Modal title={title} onClose={onClose} closeDisabled={busy} hideTitle showClose={showClose} testId={testId}>
      <S.Wrap data-art={art ? 'image' : 'icon'}>
        {art ? (
          <S.Art src={art.src} alt="" />
        ) : (
          <S.IconWrap aria-hidden>
            <WarningIcon />
          </S.IconWrap>
        )}
        <S.Heading data-testid={`${testId}-title`}>{title}</S.Heading>
        <S.Body>
          <S.Text data-testid={`${testId}-description`}>{description}</S.Text>
          {error && <S.Text data-testid={`${testId}-error`}>{error}</S.Text>}
        </S.Body>
        <S.Actions>
          {cancel && (
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              data-testid={cancel.testId}
              onClick={cancel.onClick}
            >
              {cancel.label}
            </Button>
          )}
          {confirm && (
            <Button type="button" loading={busy} data-testid={confirm.testId} onClick={confirm.onClick}>
              {confirm.label}
            </Button>
          )}
        </S.Actions>
      </S.Wrap>
    </Modal>
  )
}

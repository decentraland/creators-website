import { useEffect, type ReactNode } from 'react'
import { Button } from '~/components/Button'
import { Confetti } from '~/components/Confetti'
import { WarningIcon } from '~/components/Icons'
import { Modal } from '~/components/Modal'
import { useNotifications } from '~/lib/notifications'
import * as S from './ConfirmModal.styles'

type Action = {
  label: string
  onClick: () => void
  testId: string
}

type Props = {
  title: string
  description: ReactNode
  /** Illustration shown instead of the warning glyph. */
  art?: { src: string }
  /** Glyph shown instead of the warning one, for confirmations that aren't warnings. */
  icon?: ReactNode
  /** Failure copy of a rejected confirm, shown as an error toast so the dialog keeps its shape. */
  error?: string | null
  /** Extra content under the description, e.g. an error's technical details. */
  children?: ReactNode
  /** While the confirm action is in flight: blocks closing, disables cancel, spins the confirm button. */
  busy?: boolean
  showClose?: boolean
  /** Rains the purchase confetti over the dialog: for a celebration, never a confirmation. */
  celebrate?: boolean
  onClose: () => void
  cancel?: Action
  confirm?: Action
  /** A wider dialog, for an illustrated notice with longer copy. */
  size?: 'default' | 'medium'
  /** Sizes the two actions to their labels' column and pushes them to the edges, instead of filling the row. */
  spreadActions?: boolean
  /** Keeps a lone action full width, for a dialog that hides Cancel only while its request is open. */
  fillActions?: boolean
  testId: string
}

/** Centered dialog with a glyph or illustration, a heading, copy and up to two footer actions. */
export function ConfirmModal({
  title,
  description,
  art,
  icon,
  error,
  children,
  busy = false,
  showClose = false,
  celebrate = false,
  onClose,
  cancel,
  confirm,
  size = 'default',
  spreadActions = false,
  fillActions = false,
  testId
}: Props) {
  const showToast = useNotifications(state => state.showToast)
  useEffect(() => {
    if (error) showToast(error, { type: 'error' })
  }, [error, showToast])

  return (
    <Modal
      title={title}
      size={size}
      onClose={onClose}
      closeDisabled={busy}
      hideTitle
      showClose={showClose}
      testId={testId}
    >
      {celebrate && <Confetti />}
      <S.Wrap data-art={art ? 'image' : 'icon'}>
        {art ? <S.Art src={art.src} alt="" /> : <S.IconWrap aria-hidden>{icon ?? <WarningIcon />}</S.IconWrap>}
        <S.Heading data-testid={`${testId}-title`}>{title}</S.Heading>
        <S.Body>
          <S.Text data-testid={`${testId}-description`}>{description}</S.Text>
          {children}
        </S.Body>
        <S.Actions
          data-single={(!cancel || !confirm) && !fillActions ? '' : undefined}
          data-spread={spreadActions && cancel && confirm ? '' : undefined}
        >
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

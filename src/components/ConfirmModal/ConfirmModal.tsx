import type { ReactNode } from 'react'
import { Button } from '~/components/Button'
import { Confetti } from '~/components/Confetti'
import { WarningIcon } from '~/components/Icons'
import { Modal } from '~/components/Modal'
import styles from './ConfirmModal.module.css'
import shared from '~/styles/shared.module.css'

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
  /** Failure copy shown under the description after a rejected confirm. */
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
  fillActions = false,
  testId
}: Props) {
  return (
    <Modal title={title} onClose={onClose} closeDisabled={busy} hideTitle showClose={showClose} testId={testId}>
      {celebrate && <Confetti />}
      <div className={styles.wrap} data-art={art ? 'image' : 'icon'}>
        {art ? (
          <img className={styles.art} src={art.src} alt="" />
        ) : (
          <div className={styles.iconWrap} aria-hidden>
            {icon ?? <WarningIcon />}
          </div>
        )}
        <h3 className={styles.heading} data-testid={`${testId}-title`}>
          {title}
        </h3>
        <div className={styles.body}>
          <p className={styles.text} data-testid={`${testId}-description`}>
            {description}
          </p>
          {error && (
            <p className={styles.text} data-testid={`${testId}-error`}>
              {error}
            </p>
          )}
          {children}
        </div>
        <div className={shared.modalActions} data-single={(!cancel || !confirm) && !fillActions ? '' : undefined}>
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
        </div>
      </div>
    </Modal>
  )
}

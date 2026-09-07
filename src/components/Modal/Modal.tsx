import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Close as CloseIcon } from '@mui/icons-material'
import { useTranslation } from '~/intl'
import * as S from './Modal.styles'

// Refcounted scroll lock: modals can stack (add-items + its confirm dialogs), and a
// last-writer-wins restore would leave the page locked after closing both. The lock goes on <html>:
// with `overflow-x: clip` on the root, a body overflow no longer propagates to the viewport.
// `savedOverflow` is captured only when the first modal opens: nothing else touches the root
// overflow while a modal is up, so a value set mid-stack would be clobbered on release.
let scrollLocks = 0
let savedOverflow = ''

function acquireScrollLock() {
  if (scrollLocks === 0) {
    savedOverflow = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
  }
  scrollLocks++
}

function releaseScrollLock() {
  scrollLocks--
  if (scrollLocks === 0) {
    document.documentElement.style.overflow = savedOverflow
  }
}

type Props = {
  title: string
  onClose: () => void
  children: ReactNode
  /** Blocks every close affordance (✕, Escape, scrim) while a submit is in flight. */
  closeDisabled?: boolean
  /** 'wide' for editor-style dialogs (add items); default is the 560px form dialog. */
  size?: 'default' | 'wide'
  /** Renders no title bar (confirm/error dialogs); `title` still labels the dialog for a11y. */
  hideTitle?: boolean
  /** With `hideTitle`, still shows a floating ✕ in the dialog corner. */
  showClose?: boolean
  /** Removes the dialog padding so children can draw edge-to-edge panes; the title bar keeps its own. */
  flush?: boolean
  testId?: string
}

export function Modal({
  title,
  onClose,
  children,
  closeDisabled = false,
  size = 'default',
  hideTitle = false,
  showClose = false,
  flush = false,
  testId = 'modal'
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null)

  // Latest-value refs so the document-level listeners never rebind mid-interaction.
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const closeDisabledRef = useRef(closeDisabled)
  closeDisabledRef.current = closeDisabled

  useEffect(() => {
    dialogRef.current?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !closeDisabledRef.current) closeRef.current()

      // aria-modal alone doesn't stop Tab from reaching the page behind the scrim.
      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
      if (focusables.length === 0) {
        event.preventDefault()
        return
      }
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement
      const isInside = dialogRef.current.contains(active)
      if (event.shiftKey && (active === first || !isInside)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (active === last || !isInside)) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)

    // The page must not scroll behind the scrim.
    acquireScrollLock()

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      releaseScrollLock()
    }
  }, [])

  const { t } = useTranslation()

  const closeButton = (
    <S.CloseButton
      type="button"
      aria-label={t('modal.close')}
      data-testid={`${testId}-close`}
      disabled={closeDisabled}
      onClick={onClose}
    >
      <CloseIcon fontSize="small" />
    </S.CloseButton>
  )

  return createPortal(
    <S.Scrim data-testid={`${testId}-scrim`} onClick={() => !closeDisabled && onClose()}>
      <S.Dialog
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        data-testid={testId}
        data-size={size}
        data-flush={flush || undefined}
        onClick={event => event.stopPropagation()}
      >
        {!hideTitle && (
          <S.TitleBar>
            <S.Title>{title}</S.Title>
            {closeButton}
          </S.TitleBar>
        )}
        {hideTitle && showClose && <S.FloatingClose>{closeButton}</S.FloatingClose>}
        <S.Body data-titleless={hideTitle || undefined}>{children}</S.Body>
      </S.Dialog>
    </S.Scrim>,
    document.body
  )
}

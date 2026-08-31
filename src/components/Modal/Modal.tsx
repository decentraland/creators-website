import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Close as CloseIcon } from '@mui/icons-material'
import { useTranslation } from '~/intl'
import * as S from './Modal.styles'

type Props = {
  title: string
  onClose: () => void
  children: ReactNode
  /** Blocks every close affordance (✕, Escape, scrim) while a submit is in flight. */
  closeDisabled?: boolean
  testId?: string
}

export function Modal({ title, onClose, children, closeDisabled = false, testId = 'modal' }: Props) {
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
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [])

  const { t } = useTranslation()

  return createPortal(
    <S.Scrim data-testid={`${testId}-scrim`} onClick={() => !closeDisabled && onClose()}>
      <S.Dialog
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        data-testid={testId}
        onClick={event => event.stopPropagation()}
      >
        <S.TitleBar>
          <S.Title>{title}</S.Title>
          <S.CloseButton
            type="button"
            aria-label={t('modal.close')}
            data-testid={`${testId}-close`}
            disabled={closeDisabled}
            onClick={onClose}
          >
            <CloseIcon fontSize="small" />
          </S.CloseButton>
        </S.TitleBar>
        <S.Body>{children}</S.Body>
      </S.Dialog>
    </S.Scrim>,
    document.body
  )
}

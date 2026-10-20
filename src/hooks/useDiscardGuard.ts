import { useEffect, useRef, useState } from 'react'
import { installBackGuard } from '~/lib/backGuard'
import { useBeforeUnloadGuard } from './useBeforeUnloadGuard'

/**
 * Where a flow with a draft stands: `editing` closes freely or asks when `dirty`, `busy` (a submit the
 * dialog can't be closed over) ignores every close, and `done` (success / error) closes straight away.
 */
export type DiscardGuardState = 'editing' | 'busy' | 'done'

type Options = {
  state: DiscardGuardState
  /** The draft differs from what is saved: closing while `editing` asks first. */
  dirty: boolean
  /** A submit is in flight even if the dialog is closable: reload still gets the native prompt. */
  pending?: boolean
  onClose: () => void
}

/**
 * Close handling for a dialog with unsaved work: ✕, Escape, scrim, cancel and browser back all go
 * through `requestClose`, which asks to discard (`isDiscardOpen`) rather than losing the draft; a
 * reload / tab close gets the browser's own prompt.
 */
export function useDiscardGuard({ state, dirty, pending = false, onClose }: Options) {
  const [isDiscardOpen, setDiscardOpen] = useState(false)
  useBeforeUnloadGuard(pending || (state === 'editing' && dirty))

  // The discard dialog only renders while editing: a request left over from another state must not pop up later.
  useEffect(() => {
    if (state !== 'editing') setDiscardOpen(false)
  }, [state])

  function requestClose() {
    if (state === 'done') return onClose()
    if (state !== 'editing' || isDiscardOpen) return
    if (dirty) setDiscardOpen(true)
    else onClose()
  }

  // Browser back would silently unmount the dialog; the guard absorbs it and routes it through requestClose.
  const requestCloseRef = useRef(requestClose)
  requestCloseRef.current = requestClose
  useEffect(() => installBackGuard(() => requestCloseRef.current()), [])

  return { isDiscardOpen, requestClose, keepEditing: () => setDiscardOpen(false) }
}

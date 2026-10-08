type IdleOptions = {
  /** Upper bound the browser may hold the callback once the page has loaded. */
  timeout?: number
}

/**
 * Runs `callback` once the page has finished loading and the main thread is idle, so non-critical work
 * (media, widgets, extra monitoring) never competes with the first paint. Returns a cancel function.
 */
export function afterLoadIdle(callback: () => void, { timeout = 4000 }: IdleOptions = {}): () => void {
  let cancelled = false
  let idleId: number | undefined
  let timerId: ReturnType<typeof setTimeout> | undefined

  const schedule = () => {
    if (cancelled) return
    if (typeof window.requestIdleCallback === 'function') idleId = window.requestIdleCallback(run, { timeout })
    else timerId = setTimeout(run, 1)
  }
  const run = () => {
    if (!cancelled) callback()
  }

  if (document.readyState === 'complete') schedule()
  else window.addEventListener('load', schedule, { once: true })

  return () => {
    cancelled = true
    window.removeEventListener('load', schedule)
    if (idleId !== undefined) window.cancelIdleCallback?.(idleId)
    if (timerId !== undefined) clearTimeout(timerId)
  }
}

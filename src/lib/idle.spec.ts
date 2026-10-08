import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { afterLoadIdle } from './idle'

const setReadyState = (state: DocumentReadyState) =>
  Object.defineProperty(document, 'readyState', { configurable: true, get: () => state })

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  setReadyState('complete')
})

describe('afterLoadIdle', () => {
  it('waits for the page load before running', () => {
    setReadyState('loading')
    const callback = vi.fn()
    afterLoadIdle(callback)

    vi.runAllTimers()
    expect(callback).not.toHaveBeenCalled()

    window.dispatchEvent(new Event('load'))
    vi.runAllTimers()
    expect(callback).toHaveBeenCalledOnce()
  })

  it('runs soon when the page has already loaded', () => {
    setReadyState('complete')
    const callback = vi.fn()
    afterLoadIdle(callback)

    vi.runAllTimers()
    expect(callback).toHaveBeenCalledOnce()
  })

  it('never runs once cancelled', () => {
    setReadyState('loading')
    const callback = vi.fn()
    const cancel = afterLoadIdle(callback)

    cancel()
    window.dispatchEvent(new Event('load'))
    vi.runAllTimers()
    expect(callback).not.toHaveBeenCalled()
  })
})

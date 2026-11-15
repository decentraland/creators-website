import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_UNCORRECTED_DRIFT_MS, resetServerClock, resyncServerClock, serverNow } from './serverClock'

const NOW = 1_794_700_000_000

function statusResponse(currentTime: unknown, ok = true) {
  return { ok, json: () => Promise.resolve({ currentTime }) }
}

describe('serverClock', () => {
  let fetchMock: ReturnType<typeof vi.fn<(url: string) => Promise<unknown>>>

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    fetchMock = vi.fn<(url: string) => Promise<unknown>>()
    global.fetch = fetchMock as unknown as typeof fetch
  })

  afterEach(() => {
    resetServerClock()
    vi.useRealTimers()
  })

  describe('when no offset was measured', () => {
    it('should sign with the device clock', () => {
      expect(serverNow()).toBe(NOW)
    })
  })

  describe('when the device clock is hours behind the server', () => {
    const behindMs = 9_291_481 // the drift in BUILDER-113: ~2.6 hours

    let changed: boolean

    beforeEach(async () => {
      fetchMock.mockResolvedValue(statusResponse(NOW + behindMs))
      changed = await resyncServerClock()
    })

    it('should read the server time from the credits server status', () => {
      expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/status$/))
    })

    it('should report that the correction changed', () => {
      expect(changed).toBe(true)
    })

    it('should sign with the server time', () => {
      expect(serverNow()).toBe(NOW + behindMs)
    })

    describe('and it is measured again with the same drift', () => {
      it('should report that nothing changed, so the request is not retried again', async () => {
        await expect(resyncServerClock()).resolves.toBe(false)
      })
    })
  })

  describe('when the drift fits in the signed-fetch window', () => {
    beforeEach(() => {
      fetchMock.mockResolvedValue(statusResponse(NOW + MAX_UNCORRECTED_DRIFT_MS - 1000))
    })

    it('should leave the device clock uncorrected and report nothing changed', async () => {
      await expect(resyncServerClock()).resolves.toBe(false)
      expect(serverNow()).toBe(NOW)
    })
  })

  describe.each([
    ['the status request fails', () => Promise.reject(new TypeError('Failed to fetch'))],
    ['the server answers an error', () => Promise.resolve(statusResponse(NOW + 3_600_000, false))],
    ['the status carries no time', () => Promise.resolve(statusResponse('soon'))]
  ])('when %s', (_name, respond) => {
    beforeEach(() => {
      fetchMock.mockImplementation(respond)
    })

    it('should keep the device clock and report nothing changed', async () => {
      await expect(resyncServerClock()).resolves.toBe(false)
      expect(serverNow()).toBe(NOW)
    })
  })

  describe('when several refused requests resync at once', () => {
    beforeEach(() => {
      fetchMock.mockResolvedValue(statusResponse(NOW - 3_600_000))
    })

    it('should measure the server time once', async () => {
      await Promise.all([resyncServerClock(), resyncServerClock(), resyncServerClock()])
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })
  })
})

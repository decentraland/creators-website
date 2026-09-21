import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'

const wallet = vi.hoisted(() => ({ session: null as { address: string; providerType?: string } | null }))
vi.mock('~/store/wallet', () => ({
  useWallet: (selector: (state: unknown) => unknown) => selector({ session: wallet.session })
}))

const analytics = vi.hoisted(() => ({ anonymousId: undefined as string | undefined }))
vi.mock('~/lib/analytics', () => ({
  getAnonymousId: () => analytics.anonymousId,
  onAnalyticsReady: (cb: () => void) => cb()
}))

const settings = vi.hoisted(() => ({ appId: 'app-id-test' }))
vi.mock('~/config', () => ({
  config: { get: (key: string, fallback = '') => (key === 'INTERCOM_APP_ID' ? settings.appId : fallback) }
}))

const intercom = vi.fn()

/** Loads the widget script the way the real one does: by defining window.Intercom on load. */
function autoLoadScript() {
  const observer = new MutationObserver(() => {
    const script = document.head.querySelector<HTMLScriptElement>('script[src*="widget.intercom.io"]')
    if (!script || script.dataset.loaded) return
    script.dataset.loaded = 'true'
    ;(window as unknown as { Intercom: unknown }).Intercom = intercom
    script.dispatchEvent(new Event('load'))
  })
  observer.observe(document.head, { childList: true })
  return observer
}

let observer: MutationObserver

beforeEach(() => {
  wallet.session = null
  analytics.anonymousId = undefined
  settings.appId = 'app-id-test'
  document.head.innerHTML = ''
  delete (window as { Intercom?: unknown }).Intercom
  intercom.mockClear()
  observer = autoLoadScript()
})

afterEach(() => {
  observer.disconnect()
  vi.resetModules()
})

describe('Intercom', () => {
  it('boots the widget for a visitor who has not signed in', async () => {
    const { Intercom } = await import('./Intercom')
    render(<Intercom />)

    await waitFor(() => expect(intercom).toHaveBeenCalledWith('update', { app_id: 'app-id-test' }))
  })

  it('tells support who the creator is and which visitor they are in the analytics', async () => {
    wallet.session = { address: '0xCreAtoR', providerType: 'injected' }
    analytics.anonymousId = 'anon-1'

    const { Intercom } = await import('./Intercom')
    render(<Intercom />)

    await waitFor(() =>
      expect(intercom).toHaveBeenCalledWith('update', {
        app_id: 'app-id-test',
        Wallet: '0xcreator',
        'Wallet type': 'injected',
        anon_id: 'anon-1'
      })
    )
  })

  it('stays out of the page entirely when no app id is configured', async () => {
    settings.appId = ''

    const { Intercom } = await import('./Intercom')
    render(<Intercom />)

    await waitFor(() => expect(document.head.querySelector('script')).toBeNull())
    expect(intercom).not.toHaveBeenCalled()
  })
})

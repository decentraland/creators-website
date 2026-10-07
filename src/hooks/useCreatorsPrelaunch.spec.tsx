import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode } from 'react'
import { FeatureFlag } from '~/lib/featureFlags'
import { setAddressListVariant, setFeatureFlags } from '~/test/featureFlags'

vi.mock('~/lib/featureFlags', async importOriginal => ({
  ...(await importOriginal<typeof import('~/lib/featureFlags')>()),
  ...(await import('~/test/featureFlags'))
}))

const wallet = vi.hoisted(() => ({ address: undefined as string | undefined, restored: true }))
vi.mock('~/store/wallet', () => ({
  useWallet: (selector: (s: { session: { address: string } | null; restored: boolean }) => unknown) =>
    selector({ session: wallet.address ? { address: wallet.address } : null, restored: wallet.restored })
}))

const track = vi.hoisted(() => vi.fn())
vi.mock('~/lib/analytics', () => ({ track }))

const { useCreatorsPrelaunch } = await import('./useCreatorsPrelaunch')

const ALLOWED = '0xAbCdEf0123456789abcdef0123456789ABCDEF01'

// One client per render so a `rerender` keeps the cached flag read, as the app does.
function renderGate() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return renderHook(() => useCreatorsPrelaunch(), { wrapper })
}

beforeEach(() => {
  wallet.address = undefined
  wallet.restored = true
  track.mockReset()
})

describe('useCreatorsPrelaunch', () => {
  it('opens the full app once the flag reads off, without waiting for the wallet', async () => {
    wallet.restored = false
    const { result } = renderGate()
    expect(result.current).toBe('pending')
    await waitFor(() => expect(result.current).toBe('open'))
    expect(track).not.toHaveBeenCalled()
  })

  it('hides the app from a visitor with no wallet while the gate is armed', async () => {
    setFeatureFlags(FeatureFlag.CREATORS_PRELAUNCH)
    setAddressListVariant(FeatureFlag.CREATORS_PRELAUNCH, [ALLOWED])
    const { result } = renderGate()
    await waitFor(() => expect(result.current).toBe('hidden'))
    expect(track).toHaveBeenCalledWith('Prelaunch gate', { outcome: 'hidden' })
  })

  it('lets a listed wallet in, whatever the casing of either side', async () => {
    setFeatureFlags(FeatureFlag.CREATORS_PRELAUNCH)
    setAddressListVariant(FeatureFlag.CREATORS_PRELAUNCH, [ALLOWED])
    wallet.address = ALLOWED.toUpperCase().replace('0X', '0x')
    const { result } = renderGate()
    await waitFor(() => expect(result.current).toBe('open'))
    expect(track).toHaveBeenCalledWith('Prelaunch gate', { outcome: 'open' })
  })

  it('hides the app from a signed-in wallet that is not listed', async () => {
    setFeatureFlags(FeatureFlag.CREATORS_PRELAUNCH)
    setAddressListVariant(FeatureFlag.CREATORS_PRELAUNCH, [ALLOWED])
    wallet.address = '0x0000000000000000000000000000000000000001'
    const { result } = renderGate()
    await waitFor(() => expect(result.current).toBe('hidden'))
  })

  it('hides everyone while the gate is armed with no list yet', async () => {
    setFeatureFlags(FeatureFlag.CREATORS_PRELAUNCH)
    wallet.address = ALLOWED
    const { result } = renderGate()
    await waitFor(() => expect(result.current).toBe('hidden'))
  })

  it('does not count a sign-out as a new curtained visitor', async () => {
    setFeatureFlags(FeatureFlag.CREATORS_PRELAUNCH)
    setAddressListVariant(FeatureFlag.CREATORS_PRELAUNCH, [ALLOWED])
    wallet.address = ALLOWED
    const { result, rerender } = renderGate()
    await waitFor(() => expect(result.current).toBe('open'))

    wallet.address = undefined
    rerender()
    await waitFor(() => expect(result.current).toBe('hidden'))
    expect(track).toHaveBeenCalledTimes(1)
    expect(track).toHaveBeenCalledWith('Prelaunch gate', { outcome: 'open' })
  })

  it('withholds the answer until the wallet restore settles when the gate is armed', async () => {
    setFeatureFlags(FeatureFlag.CREATORS_PRELAUNCH)
    setAddressListVariant(FeatureFlag.CREATORS_PRELAUNCH, [ALLOWED])
    wallet.restored = false
    const { result, rerender } = renderGate()
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(result.current).toBe('pending')
    expect(track).not.toHaveBeenCalled()

    wallet.address = ALLOWED
    wallet.restored = true
    rerender()
    await waitFor(() => expect(result.current).toBe('open'))
  })
})

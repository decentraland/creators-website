import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PreviewRenderer } from '@dcl/schemas'
import { type ReactNode } from 'react'

const getIsFeatureEnabled = vi.fn()
vi.mock('~/lib/featureFlags', async importOriginal => ({
  ...(await importOriginal<typeof import('~/lib/featureFlags')>()),
  getIsFeatureEnabled: () => getIsFeatureEnabled()
}))

const { usePreviewRenderer } = await import('./usePreviewRenderer')

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

beforeEach(() => getIsFeatureEnabled.mockReset())

describe('usePreviewRenderer', () => {
  it('waits for the flag and then settles on Unity when it is on', async () => {
    getIsFeatureEnabled.mockResolvedValue(true)
    const { result } = renderHook(() => usePreviewRenderer(), { wrapper })
    expect(result.current).toBeUndefined()
    await waitFor(() => expect(result.current).toBe(PreviewRenderer.UNITY))
  })

  it('falls back to Babylon while the flag is off or unknown', async () => {
    getIsFeatureEnabled.mockResolvedValue(false)
    const { result } = renderHook(() => usePreviewRenderer(), { wrapper })
    await waitFor(() => expect(result.current).toBe(PreviewRenderer.BABYLON))
  })
})

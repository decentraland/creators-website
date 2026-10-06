import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FeatureFlag, getAddressListVariant, getIsFeatureEnabled, resetFeatureFlagsCache } from './featureFlags'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

beforeEach(() => resetFeatureFlagsCache())
afterEach(() => fetchMock.mockReset())

const flags = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

describe('getIsFeatureEnabled', () => {
  it('reads the dapps flag file of the environment and prefixes the flag name', async () => {
    fetchMock.mockResolvedValue(flags({ flags: { 'dapps-unity-wearable-preview': true } }))
    await expect(getIsFeatureEnabled(FeatureFlag.UNITY_WEARABLE_PREVIEW)).resolves.toBe(true)
    expect(fetchMock.mock.calls[0][0]).toBe('https://feature-flags.decentraland.zone/dapps.json')
  })

  it('is off when the flag is absent, the body is malformed or the service fails', async () => {
    fetchMock.mockResolvedValueOnce(flags({ flags: {} }))
    await expect(getIsFeatureEnabled(FeatureFlag.UNITY_WEARABLE_PREVIEW)).resolves.toBe(false)
    resetFeatureFlagsCache()
    fetchMock.mockResolvedValueOnce(flags('nope', 500))
    await expect(getIsFeatureEnabled(FeatureFlag.UNITY_WEARABLE_PREVIEW)).resolves.toBe(false)
    resetFeatureFlagsCache()
    fetchMock.mockRejectedValueOnce(new Error('offline'))
    await expect(getIsFeatureEnabled(FeatureFlag.UNITY_WEARABLE_PREVIEW)).resolves.toBe(false)
  })

  it('reads each flag from the file of the application that owns it', async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        url.endsWith('/builder.json')
          ? flags({ flags: { 'builder-campaign': true } })
          : flags({ flags: { 'dapps-unity-wearable-preview': true } })
      )
    )
    await expect(getIsFeatureEnabled(FeatureFlag.CAMPAIGN)).resolves.toBe(true)
    await expect(getIsFeatureEnabled(FeatureFlag.UNITY_WEARABLE_PREVIEW)).resolves.toBe(true)
    expect(fetchMock.mock.calls.map(call => call[0])).toEqual([
      'https://feature-flags.decentraland.zone/builder.json',
      'https://feature-flags.decentraland.zone/dapps.json'
    ])
  })

  it('serves repeated reads from one fetch', async () => {
    fetchMock.mockResolvedValue(flags({ flags: { 'dapps-unity-wearable-preview': true } }))
    await Promise.all([
      getIsFeatureEnabled(FeatureFlag.UNITY_WEARABLE_PREVIEW),
      getIsFeatureEnabled(FeatureFlag.UNITY_WEARABLE_PREVIEW)
    ])
    await getIsFeatureEnabled(FeatureFlag.UNITY_WEARABLE_PREVIEW)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('getAddressListVariant', () => {
  const variant = (value: string, enabled = true) => ({
    variants: { 'builder-creators-prelaunch': { enabled, payload: { type: 'string', value } } }
  })

  it('reads the variant payload as a lowercased, de-duplicated address list', async () => {
    fetchMock.mockResolvedValue(
      flags(
        variant(
          '0xAbCdEf0123456789abcdef0123456789ABCDEF01, 0xabcdef0123456789abcdef0123456789abcdef01,\n0x0000000000000000000000000000000000000002'
        )
      )
    )
    await expect(getAddressListVariant(FeatureFlag.CREATORS_PRELAUNCH)).resolves.toEqual([
      '0xabcdef0123456789abcdef0123456789abcdef01',
      '0x0000000000000000000000000000000000000002'
    ])
    expect(fetchMock.mock.calls[0][0]).toBe('https://feature-flags.decentraland.zone/builder.json')
  })

  it('accepts one address per line, with or without commas', async () => {
    fetchMock.mockResolvedValue(
      flags(
        variant(
          '0x0000000000000000000000000000000000000001\r\n0x0000000000000000000000000000000000000002\n  0x0000000000000000000000000000000000000003  '
        )
      )
    )
    await expect(getAddressListVariant(FeatureFlag.CREATORS_PRELAUNCH)).resolves.toEqual([
      '0x0000000000000000000000000000000000000001',
      '0x0000000000000000000000000000000000000002',
      '0x0000000000000000000000000000000000000003'
    ])
  })

  it('drops anything that is not an address rather than trusting it', async () => {
    fetchMock.mockResolvedValue(flags(variant('0x1234, not-an-address, 0x0000000000000000000000000000000000000003')))
    await expect(getAddressListVariant(FeatureFlag.CREATORS_PRELAUNCH)).resolves.toEqual([
      '0x0000000000000000000000000000000000000003'
    ])
  })

  it('reads no list for an absent variant, a disabled one or a failing service', async () => {
    fetchMock.mockResolvedValueOnce(flags({ flags: { 'builder-creators-prelaunch': true } }))
    await expect(getAddressListVariant(FeatureFlag.CREATORS_PRELAUNCH)).resolves.toEqual([])
    resetFeatureFlagsCache()
    fetchMock.mockResolvedValueOnce(flags(variant('0x0000000000000000000000000000000000000003', false)))
    await expect(getAddressListVariant(FeatureFlag.CREATORS_PRELAUNCH)).resolves.toEqual([])
    resetFeatureFlagsCache()
    fetchMock.mockRejectedValueOnce(new Error('offline'))
    await expect(getAddressListVariant(FeatureFlag.CREATORS_PRELAUNCH)).resolves.toEqual([])
  })
})

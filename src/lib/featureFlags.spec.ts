import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FeatureFlag, getAddressListGate, getIsFeatureEnabled, resetFeatureFlagsCache } from './featureFlags'

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

describe('getAddressListGate', () => {
  const armed = (value: string, variantEnabled = true) => ({
    flags: { 'builder-creators-prelaunch': true },
    variants: { 'builder-creators-prelaunch': { enabled: variantEnabled, payload: { type: 'string', value } } }
  })
  const gate = () => getAddressListGate(FeatureFlag.CREATORS_PRELAUNCH)

  afterEach(() => vi.unstubAllEnvs())

  it('reads the payload as a lowercased, de-duplicated list, one address per line or per comma', async () => {
    fetchMock.mockResolvedValue(
      flags(
        armed(
          '0xAbCdEf0123456789abcdef0123456789ABCDEF01, 0xabcdef0123456789abcdef0123456789abcdef01,\r\n0x0000000000000000000000000000000000000002\n  0x0000000000000000000000000000000000000003  '
        )
      )
    )
    await expect(gate()).resolves.toEqual({
      enabled: true,
      allowed: [
        '0xabcdef0123456789abcdef0123456789abcdef01',
        '0x0000000000000000000000000000000000000002',
        '0x0000000000000000000000000000000000000003'
      ]
    })
    expect(fetchMock.mock.calls[0][0]).toBe('https://feature-flags.decentraland.zone/builder.json')
  })

  it('drops anything that is not an address rather than trusting it', async () => {
    fetchMock.mockResolvedValue(flags(armed('0x1234, not-an-address, 0x0000000000000000000000000000000000000003')))
    await expect(gate()).resolves.toEqual({ enabled: true, allowed: ['0x0000000000000000000000000000000000000003'] })
  })

  it('is on with no list when the flag has no variant or a disabled one', async () => {
    fetchMock.mockResolvedValueOnce(flags({ flags: { 'builder-creators-prelaunch': true } }))
    await expect(gate()).resolves.toEqual({ enabled: true, allowed: [] })
    resetFeatureFlagsCache()
    fetchMock.mockResolvedValueOnce(flags(armed('0x0000000000000000000000000000000000000003', false)))
    await expect(gate()).resolves.toEqual({ enabled: true, allowed: [] })
  })

  describe('dev overrides', () => {
    beforeEach(() => vi.stubEnv('DEV', true))

    it('answers from the overrides alone when both are set, without reading the service', async () => {
      vi.stubEnv('VITE_FEATURE_FLAG_OVERRIDES', 'creators-prelaunch:true')
      vi.stubEnv(
        'VITE_FEATURE_FLAG_VARIANT_OVERRIDES',
        'creators-prelaunch:0x0000000000000000000000000000000000000001,0x0000000000000000000000000000000000000002'
      )
      await expect(gate()).resolves.toEqual({
        enabled: true,
        allowed: ['0x0000000000000000000000000000000000000001', '0x0000000000000000000000000000000000000002']
      })
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('takes the flag from the override and the list from the service', async () => {
      vi.stubEnv('VITE_FEATURE_FLAG_OVERRIDES', 'creators-prelaunch:true')
      fetchMock.mockResolvedValue(flags({ ...armed('0x0000000000000000000000000000000000000003'), flags: {} }))
      await expect(gate()).resolves.toEqual({ enabled: true, allowed: ['0x0000000000000000000000000000000000000003'] })
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('takes the list from the override and the flag from the service, so an off flag still means no list', async () => {
      vi.stubEnv('VITE_FEATURE_FLAG_VARIANT_OVERRIDES', 'creators-prelaunch:0x0000000000000000000000000000000000000004')
      fetchMock.mockResolvedValueOnce(flags({ flags: { 'builder-creators-prelaunch': true } }))
      await expect(gate()).resolves.toEqual({ enabled: true, allowed: ['0x0000000000000000000000000000000000000004'] })
      resetFeatureFlagsCache()
      fetchMock.mockResolvedValueOnce(flags({ flags: {} }))
      await expect(gate()).resolves.toEqual({ enabled: false, allowed: [] })
    })

    it('forcing the flag off wins over an armed service', async () => {
      vi.stubEnv('VITE_FEATURE_FLAG_OVERRIDES', 'creators-prelaunch:false')
      fetchMock.mockResolvedValue(flags(armed('0x0000000000000000000000000000000000000003')))
      await expect(gate()).resolves.toEqual({ enabled: false, allowed: [] })
    })
  })

  it('reads the flag and its list from one fetch', async () => {
    fetchMock.mockResolvedValue(
      flags({
        flags: { 'builder-creators-prelaunch': true },
        variants: {
          'builder-creators-prelaunch': {
            enabled: true,
            payload: { type: 'string', value: '0x0000000000000000000000000000000000000001' }
          }
        }
      })
    )
    await expect(getAddressListGate(FeatureFlag.CREATORS_PRELAUNCH)).resolves.toEqual({
      enabled: true,
      allowed: ['0x0000000000000000000000000000000000000001']
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('is off with no list when the flag is off or the service fails, whatever the variant says', async () => {
    fetchMock.mockResolvedValueOnce(
      flags({
        flags: {},
        variants: {
          'builder-creators-prelaunch': {
            enabled: true,
            payload: { type: 'string', value: '0x0000000000000000000000000000000000000001' }
          }
        }
      })
    )
    await expect(getAddressListGate(FeatureFlag.CREATORS_PRELAUNCH)).resolves.toEqual({ enabled: false, allowed: [] })
    resetFeatureFlagsCache()
    fetchMock.mockRejectedValueOnce(new Error('offline'))
    await expect(getAddressListGate(FeatureFlag.CREATORS_PRELAUNCH)).resolves.toEqual({ enabled: false, allowed: [] })
  })
})

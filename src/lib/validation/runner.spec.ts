import { describe, expect, it, vi } from 'vitest'

const validate = vi.fn().mockResolvedValue({
  findings: [{ check: 'thumbnail', severity: 'warning', message: 'Not transparent' }],
  checks: [{ check: 'thumbnail', status: 'passed' }]
})
vi.mock('@dcl-regenesislabs/wearable-validator', () => ({
  validate: (...args: unknown[]) => validate(...args),
  manifest: { fileSize: { thumbnailRecommendedSize: 256 } },
  checks: { thumbnail: { title: 'Thumbnail' } }
}))
vi.mock('../monitoring', () => ({ captureError: vi.fn() }))

const { runOffMainThread } = await import('./runner')

describe('validation runner', () => {
  it('runs the rule book inline where workers are unavailable', async () => {
    expect(typeof Worker).toBe('undefined')
    const output = await runOffMainThread({ kind: 'thumbnail', path: 'thumbnail.png', bytes: new Uint8Array([1]) })
    expect(validate).toHaveBeenCalledTimes(1)
    expect(output).toMatchObject({
      findings: [{ check: 'thumbnail', message: 'Not transparent' }],
      titles: { thumbnail: 'Thumbnail' },
      thumbnailRecommendedSize: 256
    })
  })
})

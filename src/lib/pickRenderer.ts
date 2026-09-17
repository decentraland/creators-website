// Chooses the preview renderer, ported from shop's lib/pickRenderer WITHOUT its mobile short-circuit:
// the editor keeps Unity on phones too. Decided once per preview mount by the caller.
import { PreviewRenderer } from '@dcl/schemas'

// Benchmark: Unity ~2.8s at ~300Mbps vs ~15.7s at ~4Mbps — require a comfortable link for the big bundle.
export const UNITY_MIN_MBPS = 10
// navigator.connection.downlink is a coarse browser estimate, capped differently than a real transfer,
// so it gets its own lower, non-comparable bar.
export const UNITY_MIN_DOWNLINK_MBPS = 4
export const UNITY_MIN_DEVICE_MEMORY = 4 // GB
// A hi-DPI screen paired with a modest core count is a proxy for a mid-tier GPU that would struggle
// to drive full-DPR Unity.
export const UNITY_MIN_DPR = 2
export const UNITY_HIDPI_MIN_HW_CONCURRENCY = 8

// Transfers smaller than this are dominated by latency/slow-start and skew the throughput estimate.
const MIN_SAMPLE_BYTES = 30_000

export type RendererReason =
  | 'url-override'
  | 'flag-off'
  | 'save-data'
  | 'slow-connection'
  | 'low-device-memory'
  | 'gpu-capability'
  | 'connection-ok'
  | 'optimistic-default'

export type RendererDecision = { renderer: PreviewRenderer; reason: RendererReason }

export type RendererInputs = {
  /** `?unity=false` resolved by `~/config`. */
  override: 'babylon' | null
  /** The `unity-wearable-preview` flag; unknown counts as off. */
  unityEnabled: boolean
}

type NavigatorConnection = { downlink?: number; saveData?: boolean }

function connection(): NavigatorConnection | undefined {
  if (typeof navigator === 'undefined') return undefined
  return (navigator as unknown as { connection?: NavigatorConnection }).connection
}

function deviceMemory(): number | undefined {
  if (typeof navigator === 'undefined') return undefined
  return (navigator as unknown as { deviceMemory?: number }).deviceMemory
}

function hardwareConcurrency(): number | undefined {
  if (typeof navigator === 'undefined') return undefined
  return (navigator as unknown as { hardwareConcurrency?: number }).hardwareConcurrency
}

function devicePixelRatio(): number | undefined {
  if (typeof window === 'undefined') return undefined
  return typeof window.devicePixelRatio === 'number' ? window.devicePixelRatio : undefined
}

// Peak downlink (Mbps) from same-origin assets already fetched, so no extra request; null when
// nothing usable has loaded yet.
function measuredMbps(): number | null {
  if (typeof performance === 'undefined' || typeof performance.getEntriesByType !== 'function') return null
  let best: number | null = null
  for (const entry of performance.getEntriesByType('resource') as PerformanceResourceTiming[]) {
    if (entry.transferSize >= MIN_SAMPLE_BYTES && entry.duration > 0) {
      const mbps = (entry.transferSize * 8) / 1e6 / (entry.duration / 1000)
      if (best === null || mbps > best) best = mbps
    }
  }
  return best
}

/** Unity when allowed and the device/connection look up to it; unknown signals stay optimistic. */
export function pickRenderer({ override, unityEnabled }: RendererInputs): RendererDecision {
  const babylon = (reason: RendererReason): RendererDecision => ({ renderer: PreviewRenderer.BABYLON, reason })

  if (override === 'babylon') return babylon('url-override')
  if (!unityEnabled) return babylon('flag-off')

  const conn = connection()
  if (conn?.saveData) return babylon('save-data')

  const measured = measuredMbps()
  const downlink = conn?.downlink
  if (measured !== null && measured < UNITY_MIN_MBPS) return babylon('slow-connection')
  if (measured === null && typeof downlink === 'number' && downlink > 0 && downlink < UNITY_MIN_DOWNLINK_MBPS) {
    return babylon('slow-connection')
  }

  const memory = deviceMemory()
  if (memory !== undefined && memory < UNITY_MIN_DEVICE_MEMORY) return babylon('low-device-memory')

  const dpr = devicePixelRatio()
  const cores = hardwareConcurrency()
  if (dpr !== undefined && dpr >= UNITY_MIN_DPR && cores !== undefined && cores < UNITY_HIDPI_MIN_HW_CONCURRENCY) {
    return babylon('gpu-capability')
  }

  const hasReading = measured !== null || typeof downlink === 'number'
  return { renderer: PreviewRenderer.UNITY, reason: hasReading ? 'connection-ok' : 'optimistic-default' }
}

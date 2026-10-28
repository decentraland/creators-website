// Measures the link with one fixed, incompressible download. Resource timings are no substitute: on a
// warm cache every bundle is a 304 (300 bytes on the wire) or a cache hit (0 bytes), so nothing is measurable.
export const PROBE_URL = `${import.meta.env.BASE_URL}speed-probe.bin`
export const PROBE_TIMEOUT_MS = 4_000
// Below this the transfer is latency, not throughput.
const MIN_PROBE_BYTES = 30_000

/** Downlink in Mbps: `0` when the probe timed out (that slow is slow), `null` when it could not run. */
export async function measureDownlinkMbps(): Promise<number | null> {
  try {
    const started = performance.now()
    const response = await fetch(PROBE_URL, { cache: 'no-store', signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) })
    if (!response.ok) {
      await response.body?.cancel()
      return null
    }
    const bytes = (await response.arrayBuffer()).byteLength
    if (bytes < MIN_PROBE_BYTES) return null
    return (bytes * 8) / 1e6 / ((performance.now() - started) / 1000)
  } catch (error) {
    return error instanceof DOMException && error.name === 'TimeoutError' ? 0 : null
  }
}

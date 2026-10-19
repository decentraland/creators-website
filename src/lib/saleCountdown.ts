// The countdown a running discount shows, ported from the Shop's lib/sale so both read the same.

/** Milliseconds left until `endsAt`, floored at 0; Infinity without an end. */
export function saleTimeLeft(endsAt: number | undefined, now: number = Date.now()): number {
  if (endsAt == null) return Infinity
  return Math.max(0, endsAt - now)
}

/** "2d 4h", then "4h 12m", "12m 30s", "45s": seconds only under an hour. Empty at or after zero. */
export function formatCountdown(msLeft: number): string {
  if (!isFinite(msLeft) || msLeft <= 0) return ''
  const totalSec = Math.floor(msLeft / 1000)
  const d = Math.floor(totalSec / 86400)
  const h = Math.floor((totalSec % 86400) / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (d > 0) return h > 0 ? `${d}d ${h}h` : `${d}d`
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

/** How often a countdown repaints: every second in its last hour, where seconds show, every minute before. */
export function countdownTickMs(msLeft: number): number {
  if (!isFinite(msLeft) || msLeft <= 0) return 0
  return msLeft < 3600_000 ? 1000 : 60_000
}

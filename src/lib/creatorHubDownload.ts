// The overview hero's one-click Creator Hub download. sites' `/download/creator-hub-success` keeps the rest
// of the funnel, so `download_started` keeps sites' props and goes to sites' Segment source.
import { config } from '~/config'
import { ensureAnonymousId } from '~/lib/analytics'
import { currentAddress } from '~/lib/currentAddress'
import { HttpError } from '~/lib/http'
import { redirectExternal } from '~/lib/navigation'
import { sendOverviewTrack } from '~/lib/overviewSegment'

type Asset = { name: string; browser_download_url: string }

export type MacArch = 'apple_silicon' | 'intel' | 'unknown'

export type CreatorHubDownload = { os: 'Windows' | 'macOS'; arch: 'amd64' | 'arm64'; href: string; macArch?: MacArch }

/** The user agent and touch points the browser reports, and a lazy read of the Mac's chip. */
export type Device = { userAgent: string; maxTouchPoints: number; macArch: () => MacArch }

const FETCH_TIMEOUT_MS = 10_000
// Lets the browser start the file download before the page leaves.
export const SUCCESS_REDIRECT_DELAY_MS = 3000

export async function fetchCreatorHubAssets(): Promise<Asset[]> {
  const response = await fetch(config.get('CREATOR_HUB_RELEASE_URL'), { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
  // GitHub's per-IP rate limit (shared NATs hit it): the CTA's download-page fallback covers it, not an error.
  if (response.status === 403 || response.status === 429) {
    await response.body?.cancel()
    return []
  }
  if (!response.ok) {
    await response.body?.cancel()
    throw new HttpError('creator hub release request failed', response.status)
  }
  const release = (await response.json()) as { assets?: Asset[] }
  return Array.isArray(release.assets) ? release.assets : []
}

// The href lands on the CTA, so only an asset of the Creator Hub's own releases qualifies.
const isReleaseAsset = (url: string) => {
  try {
    const { protocol, hostname, pathname } = new URL(url)
    return (
      protocol === 'https:' &&
      hostname === 'github.com' &&
      pathname.startsWith('/decentraland/creator-hub/releases/download/')
    )
  } catch {
    return false
  }
}

/** The installer for this device, or null where none ships (Linux, iPad, a release missing the asset). */
export function pickCreatorHubDownload(assets: Asset[], device: Device): CreatorHubDownload | null {
  const find = (platform: string) =>
    assets.find(
      asset =>
        asset.name.includes(platform) && /\.(exe|dmg)$/.test(asset.name) && isReleaseAsset(asset.browser_download_url)
    )?.browser_download_url
  if (device.userAgent.includes('Windows')) {
    const href = find('win-x64')
    return href ? { os: 'Windows', arch: 'amd64', href } : null
  }
  // iPadOS Safari sends a Mac user agent; only the touch points tell it apart.
  if (device.userAgent.includes('Macintosh') && device.maxTouchPoints <= 1) {
    const macArch = device.macArch()
    const arm = find('mac-arm64')
    const intel = find('mac-x64')
    // An unknown chip gets the Apple Silicon build, as sites does: nearly every Mac sold since 2021.
    if (macArch !== 'intel' && arm) return { os: 'macOS', arch: 'arm64', href: arm, macArch }
    return intel ? { os: 'macOS', arch: 'amd64', href: intel, macArch } : null
  }
  return null
}

let cachedMacArch: MacArch | undefined

/**
 * The Mac's chip from its GPU: the user agent says "Intel" on every Mac and Safari ships no client hints,
 * but Apple Silicon always has an Apple GPU and Intel Macs never do.
 */
export function detectMacArch(): MacArch {
  cachedMacArch ??= readMacArch()
  return cachedMacArch
}

function readMacArch(): MacArch {
  try {
    const gl = document.createElement('canvas').getContext('webgl')
    const info = gl?.getExtension('WEBGL_debug_renderer_info')
    const renderer = info ? String(gl?.getParameter(info.UNMASKED_RENDERER_WEBGL)) : ''
    // Some browsers cap live WebGL contexts.
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
    if (/apple/i.test(renderer)) return 'apple_silicon'
    // NVIDIA and AMD shipped only in Intel-era Macs.
    if (/intel|amd|radeon|nvidia|geforce|quadro/i.test(renderer)) return 'intel'
    return 'unknown'
  } catch {
    return 'unknown'
  }
}

/** The Mac's chip, or null off a Mac (iPads included). */
export function macArchHint(): MacArch | null {
  return navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints <= 1 ? detectMacArch() : null
}

let pendingRedirect: ReturnType<typeof setTimeout> | undefined

/** Reports `download_started`, then hands the visitor to sites' success page, joined on `anon_user_id`. */
export function startCreatorHubDownload({ os, arch, href }: CreatorHubDownload): void {
  if (pendingRedirect) return
  const anonUserId = ensureAnonymousId()
  sendOverviewTrack('download_started', {
    download_target: 'creator_hub',
    href,
    os,
    arch,
    auth_state: currentAddress() ? 'authenticated' : 'anonymous',
    revisit: 0,
    place: 'creators-hero',
    anon_user_id: anonUserId,
    started_at: Date.now()
  })
  const success = new URL('/download/creator-hub-success', config.get('SITES_URL'))
  success.search = new URLSearchParams({ os, arch, anon_user_id: anonUserId }).toString()
  pendingRedirect = setTimeout(() => {
    pendingRedirect = undefined
    redirectExternal(success.toString())
  }, SUCCESS_REDIRECT_DELAY_MS)
}

/** Drops a pending success redirect, for when the visitor leaves the page first. */
export function cancelCreatorHubRedirect(): void {
  clearTimeout(pendingRedirect)
  pendingRedirect = undefined
}

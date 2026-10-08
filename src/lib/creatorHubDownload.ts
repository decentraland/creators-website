// The overview hero's one-click Creator Hub download. sites' `/download/creator-hub-success` keeps the rest
// of the funnel, so `download_started` keeps sites' props and goes to sites' Segment source.
import { config } from '~/config'
import { ensureAnonymousId } from '~/lib/analytics'
import { currentAddress } from '~/lib/currentAddress'
import { HttpError } from '~/lib/http'
import { sendOverviewTrack } from '~/lib/overviewSegment'

type Asset = { name: string; browser_download_url: string }

export type CreatorHubDownload = { os: 'Windows' | 'macOS'; arch: 'amd64' | 'arm64'; href: string }

const LATEST_RELEASE_URL = 'https://api.github.com/repos/decentraland/creator-hub/releases/latest'
const FETCH_TIMEOUT_MS = 10_000
// Lets the browser start the file download before the page leaves.
export const SUCCESS_REDIRECT_DELAY_MS = 3000

export async function fetchCreatorHubAssets(): Promise<Asset[]> {
  const response = await fetch(LATEST_RELEASE_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
  if (!response.ok) {
    await response.body?.cancel()
    throw new HttpError('creator hub release request failed', response.status)
  }
  const release = (await response.json()) as { assets?: Asset[] }
  return Array.isArray(release.assets) ? release.assets : []
}

/** The installer for this user agent, or null where none ships (Linux, a release missing the asset). */
export function pickCreatorHubDownload(assets: Asset[], userAgent: string): CreatorHubDownload | null {
  const find = (platform: string) =>
    assets.find(asset => asset.name.includes(platform) && /\.(exe|dmg)$/.test(asset.name))?.browser_download_url
  if (userAgent.includes('Windows')) {
    const href = find('win-x64')
    return href ? { os: 'Windows', arch: 'amd64', href } : null
  }
  if (userAgent.includes('Macintosh')) {
    // ponytail: Apple Silicon build for every Mac (as sites does); Intel Macs need the download page.
    const arm = find('mac-arm64')
    if (arm) return { os: 'macOS', arch: 'arm64', href: arm }
    const intel = find('mac-x64')
    return intel ? { os: 'macOS', arch: 'amd64', href: intel } : null
  }
  return null
}

/** Reports `download_started`, then hands the visitor to sites' success page, joined on `anon_user_id`. */
export function startCreatorHubDownload({ os, arch, href }: CreatorHubDownload): void {
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
  setTimeout(() => window.location.assign(success.toString()), SUCCESS_REDIRECT_DELAY_MS)
}

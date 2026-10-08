import { useQuery } from '@tanstack/react-query'
import {
  type CreatorHubDownload,
  detectMacArch,
  fetchCreatorHubAssets,
  pickCreatorHubDownload
} from '~/lib/creatorHubDownload'

/** Why the CTA links to the download page instead: still loading, no release (error or rate limit), or no installer for this OS. */
export type DownloadFallback = 'loading' | 'unavailable' | 'unsupported'

/** The visitor's Creator Hub installer from the latest release, or why there is none. */
export function useCreatorHubDownload(enabled: boolean): {
  download?: CreatorHubDownload
  fallback?: DownloadFallback
} {
  const { data, isError } = useQuery({
    queryKey: ['creator-hub-release'],
    queryFn: fetchCreatorHubAssets,
    enabled,
    staleTime: 30 * 60_000,
    retry: 1,
    meta: { reportOnlyHttpErrors: true },
    select: assets => ({
      released: assets.length > 0,
      download: pickCreatorHubDownload(assets, {
        userAgent: navigator.userAgent,
        maxTouchPoints: navigator.maxTouchPoints,
        macArch: detectMacArch
      })
    })
  })
  if (data?.download) return { download: data.download }
  if (data) return { fallback: data.released ? 'unsupported' : 'unavailable' }
  return { fallback: isError ? 'unavailable' : 'loading' }
}

import { useQuery } from '@tanstack/react-query'
import { detectMacArch, fetchCreatorHubAssets, pickCreatorHubDownload } from '~/lib/creatorHubDownload'

/** The visitor's Creator Hub installer from the latest release; undefined while loading or when none fits. */
export function useCreatorHubDownload(enabled: boolean) {
  const { data } = useQuery({
    queryKey: ['creator-hub-release'],
    queryFn: fetchCreatorHubAssets,
    enabled,
    staleTime: 30 * 60_000,
    retry: 1,
    meta: { reportOnlyHttpErrors: true },
    select: assets =>
      pickCreatorHubDownload(assets, {
        userAgent: navigator.userAgent,
        maxTouchPoints: navigator.maxTouchPoints,
        macArch: detectMacArch
      })
  })
  return data ?? undefined
}

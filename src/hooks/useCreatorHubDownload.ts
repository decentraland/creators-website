import { useQuery } from '@tanstack/react-query'
import { fetchCreatorHubAssets, pickCreatorHubDownload } from '~/lib/creatorHubDownload'

/** The visitor's Creator Hub installer from the latest release; undefined while loading or when none fits. */
export function useCreatorHubDownload() {
  const { data } = useQuery({
    queryKey: ['creator-hub-release'],
    queryFn: fetchCreatorHubAssets,
    staleTime: 30 * 60_000,
    retry: 1,
    meta: { reportOnlyHttpErrors: true },
    select: assets => pickCreatorHubDownload(assets, navigator.userAgent)
  })
  return data ?? undefined
}

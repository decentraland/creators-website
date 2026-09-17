import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { type PreviewRenderer } from '@dcl/schemas'
import { previewRendererOverride } from '~/config'
import { FeatureFlag, getIsFeatureEnabled } from '~/lib/featureFlags'
import { pickRenderer } from '~/lib/pickRenderer'

/**
 * The renderer the preview should mount with, decided once per mount: `undefined` while the
 * `unity-wearable-preview` flag is still being read (callers render nothing for the preview then).
 */
export function usePreviewRenderer(): PreviewRenderer | undefined {
  const flag = useQuery({
    queryKey: ['feature-flag', FeatureFlag.UNITY_WEARABLE_PREVIEW],
    queryFn: () => getIsFeatureEnabled(FeatureFlag.UNITY_WEARABLE_PREVIEW),
    // A URL override needs no flag: it forces Babylon either way.
    enabled: previewRendererOverride === null,
    staleTime: 60_000
  })
  const [renderer, setRenderer] = useState<PreviewRenderer>()
  const settled = previewRendererOverride !== null || flag.isFetched
  useEffect(() => {
    if (renderer !== undefined || !settled) return
    setRenderer(pickRenderer({ override: previewRendererOverride, unityEnabled: flag.data === true }).renderer)
  }, [renderer, settled, flag.data])
  return renderer
}

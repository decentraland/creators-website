import { useEffect, useState } from 'react'
import { type PreviewRenderer } from '@dcl/schemas'
import { previewRendererOverride } from '~/config'
import { FeatureFlag } from '~/lib/featureFlags'
import { pickRenderer } from '~/lib/pickRenderer'
import { useFeatureFlag } from './useFeatureFlag'

/**
 * The renderer the preview should mount with, decided once per mount: `undefined` while the
 * `unity-wearable-preview` flag is still being read (callers render nothing for the preview then).
 */
export function usePreviewRenderer(): PreviewRenderer | undefined {
  // A URL override needs no flag: it forces Babylon either way.
  const flag = useFeatureFlag(FeatureFlag.UNITY_WEARABLE_PREVIEW, { enabled: previewRendererOverride === null })
  const [renderer, setRenderer] = useState<PreviewRenderer>()
  useEffect(() => {
    if (renderer !== undefined || flag.isLoading) return
    setRenderer(pickRenderer({ override: previewRendererOverride, unityEnabled: flag.enabled }).renderer)
  }, [renderer, flag.isLoading, flag.enabled])
  return renderer
}

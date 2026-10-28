import { useQuery } from '@tanstack/react-query'
import { type PreviewRenderer } from '@dcl/schemas'
import { previewRendererOverride } from '~/config'
import { track } from '~/lib/analytics'
import { measureDownlinkMbps } from '~/lib/connectionSpeed'
import { FeatureFlag, getIsFeatureEnabled } from '~/lib/featureFlags'
import { setMonitoringTags } from '~/lib/monitoring'
import { pickRenderer, type RendererDecision } from '~/lib/pickRenderer'

async function decide(): Promise<RendererDecision> {
  // A URL override needs neither the flag nor the probe: it forces Babylon either way.
  if (previewRendererOverride) {
    return pickRenderer({ override: previewRendererOverride, unityEnabled: false, measuredMbps: null })
  }
  const [unityEnabled, measuredMbps] = await Promise.all([
    getIsFeatureEnabled(FeatureFlag.UNITY_WEARABLE_PREVIEW),
    measureDownlinkMbps()
  ])
  const decision = pickRenderer({ override: null, unityEnabled, measuredMbps })
  track('Preview Renderer Picked', {
    renderer: decision.renderer,
    reason: decision.reason,
    measured_mbps: measuredMbps === null ? null : Math.round(measuredMbps * 10) / 10
  })
  setMonitoringTags({ preview_renderer: decision.renderer, preview_renderer_reason: decision.reason })
  return decision
}

/**
 * The renderer every preview mounts with, decided once per page load: `undefined` while the
 * `unity-wearable-preview` flag and the link probe are pending (callers render nothing for the preview then).
 */
export function usePreviewRenderer(): PreviewRenderer | undefined {
  return useQuery({
    queryKey: ['preview-renderer'],
    queryFn: decide,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false
  }).data?.renderer
}

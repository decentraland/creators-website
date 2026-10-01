import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { errorCode, track } from '~/lib/analytics'
import { fetchContent } from '~/lib/builder'
import { type Collection } from '~/lib/collections'
import { type Item } from '~/lib/items'
import { captureError } from '~/lib/monitoring'
import { runStaticChecks, type StaticChecksProgress, type StaticChecksResult } from '~/lib/staticChecks'

/**
 * The pre-fee static checks of the publish wizard, keyed by the items' identity and last save so an edit
 * in the items step re-runs them. A failed run is reported and retried by the creator; it never blocks.
 */
export function useStaticChecks(collection: Collection, items: Item[], enabled = true) {
  const [progress, setProgress] = useState<StaticChecksProgress | null>(null)
  const query = useQuery<StaticChecksResult>({
    queryKey: ['static-checks', collection.id, items.map(item => [item.id, item.updatedAt])],
    queryFn: async ({ signal }) => {
      setProgress(null)
      try {
        const result = await runStaticChecks(collection, items, { fetchContent, signal, onProgress: setProgress })
        track('Static checks completed', {
          collectionId: collection.id,
          item_count: items.length,
          errors: result.errors,
          warnings: result.warnings,
          durationMs: result.durationMs
        })
        return result
      } catch (error) {
        if (!signal.aborted) {
          track('Static checks error', { collectionId: collection.id, error: errorCode(error) })
          captureError(error, { flow: 'static_checks', collectionId: collection.id })
        }
        throw error
      }
    },
    enabled: enabled && items.length > 0,
    staleTime: Infinity,
    retry: false
  })
  return { ...query, progress }
}

import { useQuery } from '@tanstack/react-query'
import { useTranslation } from '~/intl'
import { captureError } from '~/lib/monitoring'
import { ValidationSeverity, getValidator, type ThumbnailSource, type ValidationResult } from '~/lib/validation'

// Blobs serialize to {} in a query key, so each one gets its own id.
const blobIds = new WeakMap<Blob, number>()
let nextBlobId = 0
function blobId(blob: Blob): number {
  let id = blobIds.get(blob)
  if (id === undefined) {
    id = nextBlobId++
    blobIds.set(blob, id)
  }
  return id
}

function sourceKey(source: ThumbnailSource): unknown {
  if (source.kind === 'item') return ['item', source.item.contents[source.item.thumbnail] ?? null]
  return ['blob', blobId(source.blob)]
}

/** Validates a thumbnail through `lib/validation`, re-running when its bytes change. `null` disables the query. */
export function useThumbnailValidation(source: ThumbnailSource | null) {
  const { t } = useTranslation()
  return useQuery<ValidationResult>({
    queryKey: ['thumbnail-validation', source ? sourceKey(source) : null],
    // A check that could not run must never read as a pass.
    queryFn: ({ signal }) =>
      getValidator()
        .validateThumbnail(source!, { signal })
        .catch((error: unknown) => {
          if (signal.aborted) throw error
          captureError(error, { flow: 'thumbnail_validation' })
          return {
            issues: [
              { code: 'thumbnail', severity: ValidationSeverity.WARNING, message: t('thumbnail_modal.check_failed') }
            ]
          }
        }),
    enabled: source !== null,
    staleTime: Infinity,
    retry: false
  })
}

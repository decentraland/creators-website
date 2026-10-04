import { useQuery } from '@tanstack/react-query'
import { getValidator, type ThumbnailSource, type ValidationResult } from '~/lib/validation'

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
  return useQuery<ValidationResult>({
    queryKey: ['thumbnail-validation', source ? sourceKey(source) : null],
    queryFn: ({ signal }) => getValidator().validateThumbnail(source!, { signal }),
    enabled: source !== null,
    staleTime: Infinity,
    retry: false
  })
}

import { useQuery } from '@tanstack/react-query'
import { getValidator, type ValidationContext, type ValidationResult, type ValidationSource } from '~/lib/validation'

/** Cache identity of a source: an item's content hashes, or the caller's id for in-memory files. */
function sourceKey(source: ValidationSource, blobId: string | undefined): unknown {
  if (source.kind === 'item') return ['item', source.item.id, Object.values(source.item.contents).sort()]
  return ['blob', blobId ?? source.mainFile]
}

/**
 * Validates a model through `lib/validation`, re-running when the item's files, its category or its
 * hides change. A run whose inputs change mid-flight is aborted. `null` source disables the query.
 */
export function useModelValidation(
  source: ValidationSource | null,
  ctx: ValidationContext,
  /** Blob sources have no stable identity of their own: the caller supplies one that changes with the files. */
  blobId?: string
) {
  return useQuery<ValidationResult>({
    queryKey: [
      'model-validation',
      source ? sourceKey(source, blobId) : null,
      ctx.type,
      ctx.category ?? null,
      ctx.hides ?? [],
      ctx.bodyShape ?? null
    ],
    queryFn: ({ signal }) => getValidator().validate(source!, ctx, { signal }),
    enabled: source !== null,
    staleTime: Infinity,
    retry: false
  })
}

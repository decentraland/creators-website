import { useQuery } from '@tanstack/react-query'
import { useTranslation } from '~/intl'
import { captureError } from '~/lib/monitoring'
import {
  ValidationSeverity,
  getValidator,
  type ValidationContext,
  type ValidationResult,
  type ValidationSource
} from '~/lib/validation'

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
  const { t } = useTranslation()
  return useQuery<ValidationResult>({
    queryKey: [
      'model-validation',
      source ? sourceKey(source, blobId) : null,
      ctx.type,
      ctx.category ?? null,
      ctx.hides ?? [],
      ctx.bodyShape ?? null
    ],
    // A check that could not run (e.g. an unsaved model's files not uploaded yet) must never read as a pass.
    queryFn: ({ signal }) =>
      getValidator()
        .validate(source!, ctx, { signal })
        .catch((error: unknown) => {
          if (signal.aborted) throw error
          captureError(error, { flow: 'model_validation' })
          return {
            issues: [
              { code: 'model', severity: ValidationSeverity.WARNING, message: t('item_editor.validation.check_failed') }
            ]
          }
        }),
    enabled: source !== null,
    staleTime: Infinity,
    retry: false
  })
}

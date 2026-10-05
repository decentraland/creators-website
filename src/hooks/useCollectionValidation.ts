import { useCallback, useMemo } from 'react'
import { useQueries, type UseQueryResult } from '@tanstack/react-query'
import { useTranslation } from '~/intl'
import { track } from '~/lib/analytics'
import { type Item } from '~/lib/items'
import {
  getValidationStatus,
  itemValidationContext,
  type ThumbnailSource,
  type ValidationIssue,
  type ValidationResult,
  type ValidationSource,
  type ValidationStatus
} from '~/lib/validation'
import { modelValidationKey, modelValidationQuery } from './useModelValidation'
import { thumbnailValidationKey, thumbnailValidationQuery } from './useThumbnailValidation'
import { useRerunValidation } from './useRerunValidation'

export type ItemValidation = { status: ValidationStatus; issues: ValidationIssue[] }

export type CollectionValidation = {
  results: Map<string, ItemValidation>
  /** Any check still running, a re-run included. */
  isValidating: boolean
}

function sources(item: Item): { model: ValidationSource; thumbnail: ThumbnailSource | null } {
  return {
    model: { kind: 'item', item },
    thumbnail: item.contents[item.thumbnail] ? { kind: 'item', item } : null
  }
}

/** The query keys of a saved item's model and thumbnail checks, for a re-run. */
export function itemValidationKeys(item: Item): (readonly unknown[])[] {
  const { model, thumbnail } = sources(item)
  const keys: (readonly unknown[])[] = [modelValidationKey(model, itemValidationContext(item))]
  if (thumbnail) keys.push(thumbnailValidationKey(thumbnail))
  return keys
}

/** Checks the model(s) and thumbnail of every item given, sharing the editor's cache. Nothing runs while disabled. */
export function useCollectionValidation(items: Item[], enabled: boolean): CollectionValidation {
  const { t } = useTranslation()
  const checked = enabled ? items : EMPTY
  const queries = useMemo(
    () =>
      checked.flatMap(item => {
        const { model, thumbnail } = sources(item)
        return [modelValidationQuery(model, itemValidationContext(item), t), thumbnailValidationQuery(thumbnail, t)]
      }),
    [checked, t]
  )
  const combine = useCallback(
    (results: UseQueryResult<ValidationResult>[]): CollectionValidation => {
      const byItem = new Map<string, ItemValidation>()
      checked.forEach((item, index) => {
        const model = results[index * 2]
        const thumbnail = results[index * 2 + 1]
        if (!model || !thumbnail) return
        const issues = model.data ? [...model.data.issues, ...(thumbnail.data?.issues ?? [])] : undefined
        byItem.set(item.id, {
          status: getValidationStatus(issues, model.isLoading || thumbnail.isLoading),
          issues: issues ?? []
        })
      })
      return { results: byItem, isValidating: results.some(result => result.isFetching) }
    },
    [checked]
  )
  return useQueries({ queries, combine })
}

const EMPTY: Item[] = []

/** Re-runs a saved item's checks and reports the outcome; resolves with the fresh issues. */
export function useRerunItemValidation() {
  const rerun = useRerunValidation()
  return useCallback(
    async (item: Item, source: 'details' | 'publish', previousStatus: ValidationStatus) => {
      const issues = await rerun(itemValidationKeys(item))
      track('Item Validation Rerun', {
        itemId: item.id,
        source,
        previousStatus,
        newStatus: getValidationStatus(issues, false)
      })
      return issues
    },
    [rerun]
  )
}

import { type Translate } from '~/intl'
import { type ItemSizes } from '~/hooks/useItemSize'

const MB = 1024 * 1024

export function formatSize(t: Translate, bytes: number): string {
  return bytes >= MB
    ? t('approval_flow.size_mb', { size: (bytes / MB).toFixed(1) })
    : t('approval_flow.size_kb', { size: (bytes / 1024).toFixed(1) })
}

/** An item's size for the upload step: measuring while unknown yet, and "Unknown" when it could not be measured. */
export function formatItemBytes(t: Translate, sizes: ItemSizes, itemId: string): string {
  const size = sizes.sizes.get(itemId)
  if (size) return formatSize(t, size.bytes)
  return t(sizes.unknown.has(itemId) ? 'approval_flow.size_unknown' : 'approval_flow.size_measuring')
}

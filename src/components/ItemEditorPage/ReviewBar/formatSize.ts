import { type Translate } from '~/intl'

const MB = 1024 * 1024

export function formatSize(t: Translate, bytes: number): string {
  return bytes >= MB
    ? t('approval_flow.size_mb', { size: (bytes / MB).toFixed(1) })
    : t('approval_flow.size_kb', { size: (bytes / 1024).toFixed(1) })
}

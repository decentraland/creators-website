import type { ReactNode } from 'react'
import { useTranslation } from '~/intl'
import { InfoTooltip } from '~/components/Tooltip'
import { getCollectionDisplayStatus, type Collection, type CollectionDisplayStatus } from '~/lib/collections'
import * as S from './CollectionStatusPill.styles'

type Props = {
  collection: Collection
  /** Overrides the status derived from the collection, e.g. once its curation has loaded. */
  status?: CollectionDisplayStatus
  /** Shown as an (i) tooltip inside the pill; the caller decides which status deserves one. */
  hint?: ReactNode
}

export function CollectionStatusPill({ collection, status: statusOverride, hint }: Props) {
  const { t } = useTranslation()
  const status = statusOverride ?? getCollectionDisplayStatus(collection)
  return (
    <S.Pill data-testid="collection-status" data-status={status}>
      {t(`collection_status.${status}`)}
      {hint && <InfoTooltip placement="right" content={hint} testId="collection-status-hint" />}
    </S.Pill>
  )
}

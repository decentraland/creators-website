import type { ReactNode } from 'react'
import { useTranslation } from '~/intl'
import { InfoTooltip } from '~/components/Tooltip'
import { getCollectionDisplayStatus, type Collection } from '~/lib/collections'
import * as S from './CollectionStatusPill.styles'

type Props = {
  collection: Collection
  /** Shown as an (i) tooltip inside the pill; the caller decides which status deserves one. */
  hint?: ReactNode
}

export function CollectionStatusPill({ collection, hint }: Props) {
  const { t } = useTranslation()
  const status = getCollectionDisplayStatus(collection)
  return (
    <S.Pill data-testid="collection-status" data-status={status}>
      {t(`collection_status.${status}`)}
      {hint && <InfoTooltip placement="right" content={hint} testId="collection-status-hint" />}
    </S.Pill>
  )
}

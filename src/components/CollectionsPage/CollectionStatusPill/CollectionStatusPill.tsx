import { useTranslation } from '~/intl'
import { getCollectionDisplayStatus, type Collection } from '~/lib/collections'
import * as S from './CollectionStatusPill.styles'

type Props = {
  collection: Collection
}

export function CollectionStatusPill({ collection }: Props) {
  const { t } = useTranslation()
  const status = getCollectionDisplayStatus(collection)
  return (
    <S.Pill data-testid="collection-status" data-status={status}>
      {t(`collections_page.status.${status}`)}
    </S.Pill>
  )
}

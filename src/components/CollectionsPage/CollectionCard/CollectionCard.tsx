import { useIntl } from 'react-intl'
import { useTranslation } from '~/intl'
import { formatTimeAgo } from '~/lib/time'
import { type Collection } from '~/lib/collections'
import { CollectionMosaic } from '../CollectionMosaic'
import { CollectionStatusPill } from '~/components/CollectionStatusPill'
import * as S from './CollectionCard.styles'

type Props = {
  collection: Collection
}

/**
 * A collection in the grid: 2x2 item mosaic over a translucent footer with name, status, item count
 * and last update. Below the mobile breakpoint it reshapes into the design's horizontal row card.
 */
export function CollectionCard({ collection }: Props) {
  const { t } = useTranslation()
  const { locale } = useIntl()

  return (
    <S.Card data-testid="collection-card" to={`/collections/${collection.id}`}>
      <S.Media>
        <CollectionMosaic collectionId={collection.id} itemCount={collection.itemCount} />
      </S.Media>
      <S.Body>
        <S.NameRow>
          <S.Name title={collection.name}>{collection.name}</S.Name>
          <CollectionStatusPill collection={collection} />
        </S.NameRow>
        <S.Meta data-testid="collection-card-items">
          {t('collections_page.item_count', { count: collection.itemCount })}
        </S.Meta>
        <S.Meta data-testid="collection-card-updated">
          {t('collections_page.updated_ago', { timeAgo: formatTimeAgo(collection.updatedAt, locale) })}
        </S.Meta>
        <S.Manage data-testid="collection-card-manage" aria-hidden>
          {t('collections_page.manage')}
        </S.Manage>
      </S.Body>
    </S.Card>
  )
}

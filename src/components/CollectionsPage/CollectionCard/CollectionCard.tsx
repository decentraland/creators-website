import { useIntl } from 'react-intl'
import { useLocation } from 'react-router-dom'
import { useTranslation } from '~/intl'
import { useWallet } from '~/store/wallet'
import { formatTimeAgo } from '~/lib/time'
import { isLinkedCollection, type Collection } from '~/lib/collections'
import { useMediaQuery } from '~/hooks/useMediaQuery'
import { theme } from '~/styles/theme'
import { CollectionMosaic } from '../CollectionMosaic'
import { CollectionStatusPill } from '~/components/CollectionStatusPill'
import { CollectionActionsMenu } from '~/components/CollectionActionsMenu'
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
  const address = useWallet(state => state.session?.address)
  const { search } = useLocation()
  // Its only entry, Edit in Builder, is desktop-only.
  const compact = useMediaQuery(theme.media.noActions)

  return (
    <S.Frame>
      <S.Card data-testid="collection-card" to={`/collections/${collection.id}`} state={{ listSearch: search }}>
        <S.Media>
          <CollectionMosaic collectionId={collection.id} itemCount={collection.itemCount} />
          {address && <S.RoleBadge collection={collection} address={address} />}
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
            {t('collections_page.updated_ago', {
              timeAgo: formatTimeAgo(collection.lastActivityAt ?? collection.updatedAt, locale)
            })}
          </S.Meta>
          <S.Manage data-testid="collection-card-manage" aria-hidden>
            {t('collections_page.manage')}
          </S.Manage>
        </S.Body>
      </S.Card>
      {address && !compact && isLinkedCollection(collection) && (
        <S.Menu>
          <CollectionActionsMenu
            collection={collection}
            address={address}
            variant="row"
            source="card"
            label={t('collections_page.row_actions')}
          />
        </S.Menu>
      )}
    </S.Frame>
  )
}

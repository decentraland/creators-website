import { useIntl } from 'react-intl'
import { useTranslation } from '~/intl'
import { useWallet } from '~/store/wallet'
import { formatTimeAgo } from '~/lib/time'
import { type Collection } from '~/lib/collections'
import { CollectionMosaic } from '~/components/CollectionMosaic'
import { CollectionActionsMenu } from '~/components/CollectionActionsMenu'
import { CollectionRolePill } from '~/components/CollectionRolePill'
import { CollectionStatusPill } from '~/components/CollectionStatusPill'
import * as S from './CollectionListRow.styles'

type Props = {
  collection: Collection
}

const DATE_FORMAT = { month: 'short', day: 'numeric', year: 'numeric' } as const

export function CollectionListRow({ collection }: Props) {
  const { t } = useTranslation()
  const intl = useIntl()
  const address = useWallet(state => state.session?.address)

  return (
    <S.Row data-testid="collection-row">
      <S.NameCell>
        <S.Thumb>
          <CollectionMosaic collectionId={collection.id} itemCount={collection.itemCount} />
        </S.Thumb>
        {/* Stretched over the whole row (see RowLink) so the row is one real link. */}
        <S.RowLink to={`/collections/${collection.id}`}>
          <S.Name title={collection.name}>{collection.name}</S.Name>
        </S.RowLink>
        {address && <CollectionRolePill collection={collection} address={address} />}
      </S.NameCell>
      <S.Cell data-testid="collection-row-items">
        {t('collections_page.item_count', { count: collection.itemCount })}
      </S.Cell>
      <S.Cell>
        <CollectionStatusPill collection={collection} />
      </S.Cell>
      <S.DateCell data-testid="collection-row-updated">
        <strong>{formatTimeAgo(collection.updatedAt, intl.locale)}</strong>
        <span>{intl.formatDate(collection.updatedAt, DATE_FORMAT)}</span>
      </S.DateCell>
      <S.Cell data-testid="collection-row-created">{intl.formatDate(collection.createdAt, DATE_FORMAT)}</S.Cell>
      <S.ActionsCell>
        {address && (
          <CollectionActionsMenu
            collection={collection}
            address={address}
            variant="row"
            showRoles={false}
            label={t('collections_page.row_actions')}
          />
        )}
      </S.ActionsCell>
    </S.Row>
  )
}

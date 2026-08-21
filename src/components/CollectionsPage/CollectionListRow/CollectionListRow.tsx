import { useNavigate } from 'react-router-dom'
import { MoreHoriz as MoreHorizIcon } from '@mui/icons-material'
import { useIntl } from 'react-intl'
import { useTranslation } from '~/intl'
import { formatTimeAgo } from '~/lib/time'
import { type Collection } from '~/lib/collections'
import { CollectionMosaic } from '../CollectionMosaic'
import { CollectionStatusPill } from '../CollectionStatusPill'
import * as S from './CollectionListRow.styles'

type Props = {
  collection: Collection
}

const DATE_FORMAT = { month: 'short', day: 'numeric', year: 'numeric' } as const

export function CollectionListRow({ collection }: Props) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const intl = useIntl()

  function open() {
    navigate(`/collections/${collection.id}`)
  }

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
        <S.ActionsButton type="button" aria-label={t('collections_page.row_actions')} onClick={open}>
          <MoreHorizIcon fontSize="small" />
        </S.ActionsButton>
      </S.ActionsCell>
    </S.Row>
  )
}

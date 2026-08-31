import { MoreHoriz as MoreHorizIcon } from '@mui/icons-material'
import { Rarity } from '@dcl/schemas'
import { useTranslation } from '~/intl'
import { getContentsStorageUrl } from '~/lib/builder'
import { getItemBodyShapeType, getItemDisplayStatus, type Item } from '~/lib/items'
import { Pill } from '~/components/CollectionStatusPill/CollectionStatusPill.styles'
import * as S from './ItemListRow.styles'

type Props = {
  item: Item
}

export function ItemListRow({ item }: Props) {
  const { t } = useTranslation()

  const thumbnailHash = item.contents[item.thumbnail]
  const bodyShapeType = getItemBodyShapeType(item)
  const category = item.data.category
  const status = getItemDisplayStatus(item)

  return (
    <S.Row data-testid="item-row">
      <S.NameCell>
        <S.Thumb>{thumbnailHash && <img src={getContentsStorageUrl(thumbnailHash)} alt="" />}</S.Thumb>
        {/* Stretched over the whole row (see NameLink) so the row is one real link. */}
        <S.NameLink to={`/collections/${item.collectionId}/items/${item.id}`} title={item.name}>
          {item.name}
        </S.NameLink>
      </S.NameCell>
      <S.Cell data-desktop data-testid="item-row-body-type">
        {bodyShapeType ? t(`collection_detail_page.body_type.${bodyShapeType}`) : '—'}
      </S.Cell>
      <S.Cell data-testid="item-row-rarity">
        {item.rarity && (
          <S.RarityPill
            data-rarity={item.rarity}
            style={
              {
                '--rarity-color': Rarity.getColor(item.rarity as Rarity),
                '--rarity-light': Rarity.getGradient(item.rarity as Rarity)[0]
              } as React.CSSProperties
            }
          >
            {t(`collection_detail_page.rarity.${item.rarity}`)}
          </S.RarityPill>
        )}
      </S.Cell>
      <S.Cell data-desktop data-testid="item-row-category">
        {category ? t(`collection_detail_page.category.${category}`) : '—'}
      </S.Cell>
      <S.Cell data-testid="item-row-status">
        <Pill data-status={status}>{t(`collection_detail_page.status.${status}`)}</Pill>
      </S.Cell>
      <S.ActionsCell>
        <S.ActionsButton
          type="button"
          aria-label={t('collection_detail_page.row_actions')}
          aria-disabled
          title={t('collection_detail_page.coming_soon')}
        >
          <MoreHorizIcon fontSize="small" />
        </S.ActionsButton>
      </S.ActionsCell>
    </S.Row>
  )
}

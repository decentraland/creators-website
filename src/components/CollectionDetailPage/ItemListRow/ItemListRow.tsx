import { MoreHoriz as MoreHorizIcon } from '@mui/icons-material'
import { useTranslation } from '~/intl'
import { getContentsStorageUrl } from '~/lib/builder'
import { getItemBodyShapeType, type Item } from '~/lib/items'
import { BodyShapeIcon, CategoryIcon } from '~/components/ItemIcons'
import { RarityPill } from '~/components/RarityPill'
import * as S from './ItemListRow.styles'

type Props = {
  item: Item
}

export function ItemListRow({ item }: Props) {
  const { t } = useTranslation()

  const thumbnailHash = item.contents[item.thumbnail]
  const bodyShapeType = getItemBodyShapeType(item)
  const category = item.data.category

  return (
    <S.Row data-testid="item-row">
      <S.Thumb>{thumbnailHash && <img src={getContentsStorageUrl(thumbnailHash)} alt="" />}</S.Thumb>
      <S.Content>
        <S.Name title={item.name}>{item.name}</S.Name>
        <S.Cell data-testid="item-row-body-shape">
          {bodyShapeType ? <BodyShapeIcon bodyShape={bodyShapeType} withLabel /> : '—'}
        </S.Cell>
        <S.Cell data-testid="item-row-category">
          {category ? <CategoryIcon category={category} withLabel /> : '—'}
        </S.Cell>
        <S.Cell data-testid="item-row-rarity">{item.rarity && <RarityPill rarity={item.rarity} />}</S.Cell>
      </S.Content>
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

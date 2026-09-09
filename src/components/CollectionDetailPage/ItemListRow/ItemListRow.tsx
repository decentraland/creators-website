import { MoreHoriz as MoreHorizIcon } from '@mui/icons-material'
import { useTranslation } from '~/intl'
import { getContentsStorageUrl } from '~/lib/builder'
import { ItemType, getItemBodyShapeType, type Item } from '~/lib/items'
import { EmotePlayMode } from '~/lib/itemFactory'
import { BodyShapeIcon, CategoryIcon, PlayModeIcon } from '~/components/ItemIcons'
import { RarityPill } from '~/components/RarityPill'
import * as S from './ItemListRow.styles'

type Props = {
  item: Item
  /** Lay out the Play Mode column; the list shows it only when the current view has emotes. */
  withPlayMode?: boolean
}

export function ItemListRow({ item, withPlayMode = false }: Props) {
  const { t } = useTranslation()

  const thumbnailHash = item.contents[item.thumbnail]
  const bodyShapeType = getItemBodyShapeType(item)
  const category = item.data.category
  const isEmote = item.type === ItemType.EMOTE

  return (
    <S.Row data-testid="item-row" data-with-play-mode={withPlayMode || undefined}>
      <S.Thumb>{thumbnailHash && <img src={getContentsStorageUrl(thumbnailHash)} alt="" />}</S.Thumb>
      <S.Content>
        <S.Name title={item.name}>{item.name}</S.Name>
        <S.Cell data-testid="item-row-body-shape">
          {bodyShapeType ? <BodyShapeIcon bodyShape={bodyShapeType} withLabel /> : '—'}
        </S.Cell>
        <S.Cell data-testid="item-row-category">
          {category ? <CategoryIcon category={category} withLabel /> : '—'}
        </S.Cell>
        {withPlayMode && (
          <S.Cell data-testid="item-row-play-mode" data-empty={!isEmote || undefined}>
            {isEmote ? (
              <PlayModeIcon playMode={item.data.loop ? EmotePlayMode.LOOP : EmotePlayMode.SIMPLE} withLabel />
            ) : (
              '—'
            )}
          </S.Cell>
        )}
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

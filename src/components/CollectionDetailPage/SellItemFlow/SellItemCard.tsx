import { useTranslation } from '~/intl'
import { getContentsStorageUrl } from '~/lib/builder'
import { EmotePlayMode } from '~/lib/itemFactory'
import { ItemType, getItemBodyShapeType, isSmartWearable, type Item } from '~/lib/items'
import { SmartIcon } from '~/components/Icons'
import { BodyShapeIcon, CategoryIcon, PlayModeIcon } from '~/components/ItemIcons'
import { ItemThumbnail } from '~/components/ItemThumbnail'
import { RarityPill } from '~/components/RarityPill'
import * as S from './SellItemModal.styles'

type Props = {
  item: Item
}

/** The item being sold: artwork, name, and its rarity / category / body shape / play mode / smart badges. */
export function SellItemCard({ item }: Props) {
  const { t } = useTranslation()
  const thumbnailHash = item.contents[item.thumbnail]
  const bodyShape = getItemBodyShapeType(item)
  const category = item.data.category
  const isEmote = item.type === ItemType.EMOTE
  const isSmart = isSmartWearable(item)

  return (
    <S.Card data-testid="sell-item-card">
      <S.CardThumb>
        <ItemThumbnail src={thumbnailHash ? getContentsStorageUrl(thumbnailHash) : null} rarity={item.rarity} />
      </S.CardThumb>
      <S.CardBody>
        <S.CardName title={item.name}>{item.name}</S.CardName>
        <S.Badges>
          {item.rarity && <RarityPill rarity={item.rarity} />}
          {category && (
            <S.Badge data-testid="sell-item-badge-category" title={t(`collection_detail_page.category.${category}`)}>
              <CategoryIcon category={category} />
            </S.Badge>
          )}
          {bodyShape && (
            <S.Badge
              data-testid="sell-item-badge-body-shape"
              title={t(`collection_detail_page.body_type.${bodyShape}`)}
            >
              <BodyShapeIcon bodyShape={bodyShape} />
            </S.Badge>
          )}
          {isEmote && (
            <S.Badge
              data-testid="sell-item-badge-play-mode"
              title={t(
                `collection_detail_page.play_mode.${item.data.loop ? EmotePlayMode.LOOP : EmotePlayMode.SIMPLE}`
              )}
            >
              <PlayModeIcon playMode={item.data.loop ? EmotePlayMode.LOOP : EmotePlayMode.SIMPLE} />
            </S.Badge>
          )}
          {isSmart && (
            <S.Badge data-testid="sell-item-badge-smart" title={t('sell_item_modal.smart_wearable')}>
              <SmartIcon />
            </S.Badge>
          )}
        </S.Badges>
      </S.CardBody>
    </S.Card>
  )
}

import { MoreHoriz as MoreHorizIcon } from '@mui/icons-material'
import { useTranslation } from '~/intl'
import { getContentsStorageUrl } from '~/lib/builder'
import { ItemType, getItemBodyShapeType, getItemSales, type Item } from '~/lib/items'
import { EmotePlayMode } from '~/lib/itemFactory'
import { type ItemListing } from '~/lib/listings'
import { formatCredits, formatMana } from '~/lib/publishFee'
import { CurrencyAmount } from '~/components/CurrencyAmount'
import { BodyShapeIcon, CategoryIcon, PlayModeIcon } from '~/components/ItemIcons'
import { ItemThumbnail } from '~/components/ItemThumbnail'
import { RarityPill } from '~/components/RarityPill'
import * as S from './ItemListRow.styles'

const EMPTY = '—'

type Props = {
  item: Item
  /** Lay out the Play Mode column; the list shows it only when the current view has emotes. */
  withPlayMode?: boolean
  /** Lay out the Price and Sales columns; the list shows them once the collection has been published. */
  withMarket?: boolean
  /** The item's primary listing: `null` when it has none, `undefined` while listings are still loading. */
  listing?: ItemListing | null
}

function formatCount(value: number): string {
  return value.toLocaleString('en-US')
}

export function ItemListRow({ item, withPlayMode = false, withMarket = false, listing }: Props) {
  const { t } = useTranslation()

  const thumbnailHash = item.contents[item.thumbnail]
  const bodyShapeType = getItemBodyShapeType(item)
  const category = item.data.category
  const isEmote = item.type === ItemType.EMOTE
  const sales = withMarket ? getItemSales(item) : undefined

  function renderPrice() {
    if (listing === undefined) return null
    if (listing === null) return EMPTY
    if (listing.currency === 'mana') {
      if (listing.manaWei === 0n) return t('collection_detail_page.price.free')
      const amount = formatMana(listing.manaWei)
      return (
        <S.Amount title={t('collection_detail_page.price.mana', { amount })}>
          <CurrencyAmount currency="mana">{amount}</CurrencyAmount>
        </S.Amount>
      )
    }
    if (listing.credits === 0) return t('collection_detail_page.price.free')
    const amount = formatCredits(listing.credits)
    return (
      <S.Amount title={t('collection_detail_page.price.credits', { amount })}>
        <CurrencyAmount currency="credits">{amount}</CurrencyAmount>
      </S.Amount>
    )
  }

  return (
    <S.Row
      data-testid="item-row"
      data-with-play-mode={withPlayMode || undefined}
      data-with-market={withMarket || undefined}
    >
      <S.Thumb>
        <ItemThumbnail src={thumbnailHash ? getContentsStorageUrl(thumbnailHash) : null} rarity={item.rarity} />
      </S.Thumb>
      <S.Content>
        <S.Name title={item.name}>{item.name}</S.Name>
        <S.Cell data-testid="item-row-body-shape">
          {bodyShapeType ? <BodyShapeIcon bodyShape={bodyShapeType} withLabel /> : EMPTY}
        </S.Cell>
        <S.Cell data-testid="item-row-category">
          {category ? <CategoryIcon category={category} withLabel /> : EMPTY}
        </S.Cell>
        {withPlayMode && (
          <S.Cell data-testid="item-row-play-mode" data-empty={!isEmote || undefined}>
            {isEmote ? (
              <PlayModeIcon playMode={item.data.loop ? EmotePlayMode.LOOP : EmotePlayMode.SIMPLE} withLabel />
            ) : (
              EMPTY
            )}
          </S.Cell>
        )}
        <S.Cell data-testid="item-row-rarity">{item.rarity && <RarityPill rarity={item.rarity} />}</S.Cell>
        {withMarket && (
          <>
            <S.Cell
              data-testid="item-row-price"
              data-currency={listing?.currency}
              data-empty={listing === null || undefined}
            >
              {renderPrice()}
            </S.Cell>
            <S.Cell data-testid="item-row-sales" data-empty={!sales || undefined}>
              {sales ? `${formatCount(sales.minted)}/${formatCount(sales.maxSupply)}` : EMPTY}
            </S.Cell>
          </>
        )}
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

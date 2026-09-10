import { type ReactNode } from 'react'
import { useIntl } from 'react-intl'
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
import { ItemSaleStatus } from '../ItemSaleStatus'
import * as S from './ItemListRow.styles'

const EMPTY = '—'

type Props = {
  item: Item
  /** Lay out the Play Mode column; the list shows it only when the current view has emotes. */
  withPlayMode?: boolean
  /** Lay out the Price, Sales and Sale Status columns; the list shows them once the collection has been published. */
  withMarket?: boolean
  /** The item's primary listing: `null` when it has none, `undefined` while listings are still loading. */
  listing?: ItemListing | null
  /** Whether the collection has been approved at least once, so its items can be put on sale. */
  canSell?: boolean
  onPutOnSale?: (item: Item) => void
  /** The row's ⋯ menu; the page supplies it once the viewer is signed in. */
  actions?: ReactNode
}

export function ItemListRow({
  item,
  withPlayMode = false,
  withMarket = false,
  listing,
  canSell = false,
  onPutOnSale,
  actions
}: Props) {
  const { t } = useTranslation()
  const intl = useIntl()

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
              {sales ? `${intl.formatNumber(sales.minted)}/${intl.formatNumber(sales.maxSupply)}` : EMPTY}
            </S.Cell>
            <S.Cell data-testid="item-row-sale-status" data-empty={listing === undefined || undefined}>
              <ItemSaleStatus
                sales={sales}
                listing={listing}
                canSell={canSell}
                onPutOnSale={onPutOnSale && (() => onPutOnSale(item))}
              />
            </S.Cell>
          </>
        )}
      </S.Content>
      <S.ActionsCell>{actions}</S.ActionsCell>
    </S.Row>
  )
}

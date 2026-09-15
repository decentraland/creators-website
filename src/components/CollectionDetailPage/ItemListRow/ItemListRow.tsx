import { useState, type KeyboardEvent, type ReactNode } from 'react'
import { Check as CheckIcon, Close as CloseIcon, Edit as EditIcon } from '@mui/icons-material'
import { useIntl } from 'react-intl'
import { useTranslation } from '~/intl'
import { getContentsStorageUrl } from '~/lib/builder'
import { ITEM_NAME_MAX_LENGTH, isValidItemName } from '~/lib/itemFactory'
import { ItemType, getItemBodyShapeType, getItemSales, isSmartWearable, type Item } from '~/lib/items'
import { EmotePlayMode } from '~/lib/itemFactory'
import { type ItemListing } from '~/lib/listings'
import { formatCredits, formatMana } from '~/lib/publishFee'
import { shopItemUrl } from '~/lib/shop'
import { CurrencyAmount } from '~/components/CurrencyAmount'
import { SmartIcon } from '~/components/Icons'
import { Tooltip } from '~/components/Tooltip'
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
  /** Offered on the price when the viewer may re-price the listing. */
  onEditPrice?: (item: Item) => void
  /** Whether the viewer may edit the name and thumbnail in place. */
  editable?: boolean
  /** Saves the new name; a rejected promise keeps the row in edit mode. */
  onRename?: (item: Item, name: string) => Promise<unknown>
  onEditThumbnail?: (item: Item) => void
  /** The collection's contract, for the Shop link on a listed item. */
  contractAddress?: string
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
  onEditPrice,
  editable = false,
  onRename,
  onEditThumbnail,
  contractAddress,
  actions
}: Props) {
  const { t } = useTranslation()
  const intl = useIntl()
  // The name being typed; `null` while the name is not being edited.
  const [draftName, setDraftName] = useState<string | null>(null)
  const [isSaving, setSaving] = useState(false)

  const thumbnailHash = item.contents[item.thumbnail]
  const bodyShapeType = getItemBodyShapeType(item)
  const category = item.data.category
  const isEmote = item.type === ItemType.EMOTE
  const isSmart = isSmartWearable(item)
  const sales = withMarket ? getItemSales(item) : undefined
  const isSoldOut = !!sales && sales.minted >= sales.maxSupply
  // Blank while listings load, and for a viewer who may not sell an unlisted item (the sold-out pill still shows).
  const isSaleStatusEmpty = listing === undefined || (listing === null && !onPutOnSale && !isSoldOut)
  const shopUrl = withMarket && contractAddress && item.tokenId ? shopItemUrl(contractAddress, item.tokenId) : undefined
  const canRename = editable && !!onRename
  const canEditThumbnail = editable && !!onEditThumbnail
  const isEditingName = draftName !== null
  const draftValid = draftName !== null && isValidItemName(draftName)

  function startEditing() {
    setDraftName(item.name)
  }

  function stopEditing() {
    if (!isSaving) setDraftName(null)
  }

  async function saveName() {
    if (draftName === null || !onRename || isSaving) return
    const name = draftName.trim()
    if (name === item.name) {
      stopEditing()
      return
    }
    if (!isValidItemName(name)) return
    setSaving(true)
    try {
      await onRename(item, name)
      stopEditing()
    } catch {
      // The page reports the failure; the row keeps the draft so the user can retry.
    } finally {
      setSaving(false)
    }
  }

  function onNameKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      void saveName()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      stopEditing()
    }
  }

  function renderAmount(listing: ItemListing) {
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

  function renderPrice() {
    if (listing === undefined) return null
    if (listing === null) return EMPTY
    const amount = renderAmount(listing)
    if (!onEditPrice) return amount
    return (
      <S.PriceButton
        type="button"
        title={t('collection_detail_page.item_actions.edit_price')}
        aria-label={t('collection_detail_page.item_actions.edit_price')}
        data-testid="item-row-edit-price"
        onClick={() => onEditPrice(item)}
      >
        {amount}
        <EditIcon aria-hidden />
      </S.PriceButton>
    )
  }

  const thumbnail = (
    <ItemThumbnail src={thumbnailHash ? getContentsStorageUrl(thumbnailHash) : null} rarity={item.rarity} />
  )

  return (
    <S.Row
      data-testid="item-row"
      data-with-play-mode={withPlayMode || undefined}
      data-with-market={withMarket || undefined}
    >
      <S.Thumb>
        {canEditThumbnail ? (
          <S.ThumbButton
            type="button"
            title={t('collection_detail_page.item_row.edit_thumbnail')}
            aria-label={t('collection_detail_page.item_row.edit_thumbnail')}
            data-testid="item-row-edit-thumbnail"
            onClick={() => onEditThumbnail?.(item)}
          >
            {thumbnail}
            <S.ThumbBadge aria-hidden>
              <EditIcon />
            </S.ThumbBadge>
          </S.ThumbButton>
        ) : (
          thumbnail
        )}
      </S.Thumb>
      <S.Content>
        {isEditingName ? (
          <S.NameEditor data-testid="item-row-name-editor">
            <S.NameInput
              value={draftName}
              maxLength={ITEM_NAME_MAX_LENGTH}
              disabled={isSaving}
              autoFocus
              aria-label={t('collection_detail_page.item_row.name_placeholder')}
              placeholder={t('collection_detail_page.item_row.name_placeholder')}
              data-invalid={draftName && !draftValid ? true : undefined}
              data-testid="item-row-name-input"
              onChange={event => setDraftName(event.target.value)}
              onKeyDown={onNameKeyDown}
            />
            <S.EditorButton
              type="button"
              data-variant="cancel"
              title={t('collection_detail_page.item_row.cancel_edit')}
              aria-label={t('collection_detail_page.item_row.cancel_edit')}
              disabled={isSaving}
              data-testid="item-row-name-cancel"
              onClick={stopEditing}
            >
              <CloseIcon />
            </S.EditorButton>
            <S.EditorButton
              type="button"
              data-variant="save"
              title={t('collection_detail_page.item_row.save')}
              aria-label={t('collection_detail_page.item_row.save')}
              disabled={!draftValid || isSaving}
              aria-busy={isSaving || undefined}
              data-testid="item-row-name-save"
              onClick={() => void saveName()}
            >
              {isSaving ? <S.Spinner aria-hidden /> : <CheckIcon />}
            </S.EditorButton>
          </S.NameEditor>
        ) : (
          <S.Name title={item.name}>
            {canRename ? (
              <S.NameButton
                type="button"
                title={t('collection_detail_page.item_row.edit_name')}
                data-testid="item-row-edit-name"
                onClick={startEditing}
              >
                <S.NameText data-testid="item-row-name">{item.name}</S.NameText>
                <EditIcon aria-hidden />
              </S.NameButton>
            ) : (
              <S.NameText data-testid="item-row-name">{item.name}</S.NameText>
            )}
            {isSmart && (
              <Tooltip content={t('collection_detail_page.smart_wearable')} asChild testId="item-row-smart-tooltip">
                <S.SmartBadge data-testid="item-row-smart" tabIndex={0}>
                  <SmartIcon />
                </S.SmartBadge>
              </Tooltip>
            )}
          </S.Name>
        )}
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
            <S.Cell data-testid="item-row-sale-status" data-empty={isSaleStatusEmpty || undefined}>
              <ItemSaleStatus
                sales={sales}
                listing={listing}
                canSell={canSell}
                onPutOnSale={onPutOnSale && (() => onPutOnSale(item))}
                shopUrl={shopUrl}
              />
            </S.Cell>
          </>
        )}
      </S.Content>
      <S.ActionsCell>{actions}</S.ActionsCell>
    </S.Row>
  )
}

import { Check as CheckIcon } from '@mui/icons-material'
import { useTranslation } from '~/intl'
import { type ItemSales } from '~/lib/items'
import { type ItemListing } from '~/lib/listings'
import { PriceTagIcon } from '~/components/Icons'
import * as S from './ItemSaleStatus.styles'

type Props = {
  sales: ItemSales | undefined
  /** The item's primary listing: `null` when it has none, `undefined` while listings are still loading. */
  listing: ItemListing | null | undefined
  /** Whether the collection has been approved at least once; until then the "Put on sale" CTA is disabled. */
  canSell?: boolean
}

/** Sold out / on sale pill, or the "Put on sale" CTA; nothing while listings are still loading. */
export function ItemSaleStatus({ sales, listing, canSell = false }: Props) {
  const { t } = useTranslation()

  if (sales && sales.minted >= sales.maxSupply) {
    return (
      <S.Pill data-testid="item-sale-status" data-status="sold_out">
        {t('collection_detail_page.sale_status.sold_out')}
      </S.Pill>
    )
  }
  if (listing === undefined) return null
  if (listing) {
    return (
      <S.Pill data-testid="item-sale-status" data-status="on_sale">
        <CheckIcon aria-hidden />
        {t('collection_detail_page.sale_status.on_sale')}
        <S.Dot aria-hidden />
      </S.Pill>
    )
  }
  // TODO: opens the put-on-sale flow once it lands.
  return (
    <S.PutOnSale
      data-testid="item-sale-status"
      data-status="not_on_sale"
      type="button"
      disabled={!canSell}
      aria-disabled
      title={t(canSell ? 'collection_detail_page.coming_soon' : 'collection_detail_page.sale_status.awaiting_approval')}
    >
      <PriceTagIcon />
      {t('collection_detail_page.sale_status.put_on_sale')}
    </S.PutOnSale>
  )
}

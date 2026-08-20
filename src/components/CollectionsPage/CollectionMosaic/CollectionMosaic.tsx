import { useWallet } from '~/store/wallet'
import { useCollectionPreview } from '~/hooks/useCollections'
import * as S from './CollectionMosaic.styles'

type Props = {
  collectionId: string
  itemCount: number
  className?: string
}

/**
 * The 2x2 cover built from a collection's first item thumbnails (same request the legacy builder's
 * CollectionImage makes). Fewer than 4 items stretch to fill; zero items render the bare media field.
 */
export function CollectionMosaic({ collectionId, itemCount, className }: Props) {
  const address = useWallet(state => state.session?.address)
  const { data: previews, isLoading } = useCollectionPreview(address, collectionId, itemCount)
  const items = (previews ?? []).slice(0, 4)

  return (
    <S.Mosaic className={className} data-testid="collection-mosaic" data-count={items.length}>
      {itemCount > 0 && isLoading ? (
        <S.Loading className="skeleton" data-testid="collection-mosaic-loading" aria-hidden />
      ) : (
        items.map(item => (
          <S.Cell key={item.id} data-testid="collection-mosaic-cell">
            <img src={item.thumbnailUrl} alt="" loading="lazy" />
          </S.Cell>
        ))
      )}
    </S.Mosaic>
  )
}

import { ItemThumbnail } from '~/components/ItemThumbnail'
import * as S from './ThumbnailMosaic.styles'

export type MosaicThumbnail = {
  url: string
  rarity?: string | null
}

type Props = {
  /** Up to four thumbnails; extra entries are ignored. */
  thumbnails: MosaicThumbnail[]
  loading?: boolean
  /** Nothing to show yet (an empty collection): a neutral wash instead of the bare media field. */
  empty?: boolean
  className?: string
  testId?: string
}

/** 2x2 thumbnail grid: fewer than 4 images stretch to fill; `empty` paints a gray wash, otherwise zero images leave the bare media field. */
export function ThumbnailMosaic({
  thumbnails,
  loading = false,
  empty = false,
  className,
  testId = 'thumbnail-mosaic'
}: Props) {
  const urls = thumbnails.slice(0, 4)
  return (
    <S.Mosaic
      className={className}
      data-testid={testId}
      data-count={urls.length}
      data-empty={(empty && !loading) || undefined}
    >
      {loading ? (
        <S.Loading className="skeleton" data-testid={`${testId}-loading`} aria-hidden />
      ) : (
        urls.map(({ url, rarity }, index) => (
          <S.Cell key={`${index}-${url}`} data-testid={`${testId}-cell`}>
            <ItemThumbnail src={url} rarity={rarity} testId={`${testId}-thumbnail`} />
          </S.Cell>
        ))
      )}
    </S.Mosaic>
  )
}

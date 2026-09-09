import * as S from './ThumbnailMosaic.styles'

type Props = {
  /** Up to four thumbnail URLs; extra entries are ignored. */
  thumbnails: string[]
  loading?: boolean
  className?: string
  testId?: string
}

/** 2x2 thumbnail grid: fewer than 4 images stretch to fill, zero images render the bare media field. */
export function ThumbnailMosaic({ thumbnails, loading = false, className, testId = 'thumbnail-mosaic' }: Props) {
  const urls = thumbnails.slice(0, 4)
  return (
    <S.Mosaic className={className} data-testid={testId} data-count={urls.length}>
      {loading ? (
        <S.Loading className="skeleton" data-testid={`${testId}-loading`} aria-hidden />
      ) : (
        urls.map((url, index) => (
          <S.Cell key={`${index}-${url}`} data-testid={`${testId}-cell`}>
            <img src={url} alt="" loading="lazy" />
          </S.Cell>
        ))
      )}
    </S.Mosaic>
  )
}

import { ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon } from '@mui/icons-material'
import { useTranslation } from '~/intl'
import { pageWindow } from '~/lib/pagination'
import * as S from './Pagination.styles'

type Props = {
  page: number
  pages: number
  onPageChange: (page: number) => void
}

/** Windowed page numbers + chevrons. Render only when there is more than one page. */
export function Pagination({ page, pages, onPageChange }: Props) {
  const { t } = useTranslation()
  return (
    <S.Root data-testid="pagination">
      <S.PageButton
        type="button"
        aria-label={t('pagination.previous')}
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeftIcon fontSize="small" />
      </S.PageButton>
      {pageWindow(page, pages).map(n => (
        <S.PageButton
          key={n}
          type="button"
          data-current={n === page || undefined}
          aria-current={n === page ? 'page' : undefined}
          onClick={() => onPageChange(n)}
        >
          {n}
        </S.PageButton>
      ))}
      <S.PageButton
        type="button"
        aria-label={t('pagination.next')}
        disabled={page >= pages}
        onClick={() => onPageChange(page + 1)}
      >
        <ChevronRightIcon fontSize="small" />
      </S.PageButton>
    </S.Root>
  )
}

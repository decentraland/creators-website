import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Add as AddIcon,
  ArrowBackIosNew as ArrowBackIosNewIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  FormatListBulleted as FormatListBulletedIcon,
  FormatShapes as FormatShapesIcon,
  GridView as GridViewIcon,
  PersonOutline as PersonOutlineIcon,
  Search as SearchIcon
} from '@mui/icons-material'
import { useTranslation } from '~/intl'
import { useWallet } from '~/store/wallet'
import { useCollections, useRejectedCollectionsCount } from '~/hooks/useCollections'
import { CollectionStatusFilter } from '~/lib/collections'
import emptyCollectionsArt from '~/assets/empty-collections.png'
import { CollectionCard } from './CollectionCard'
import { CollectionListRow } from './CollectionListRow'
import * as S from './CollectionsPage.styles'

const STATUS_FILTERS = Object.values(CollectionStatusFilter)
const SEARCH_DEBOUNCE_MS = 500
const LEARN_MORE_URL =
  'https://docs.decentraland.org/creator/wearables-and-emotes/manage-collections/creating-a-collection/'

type ViewMode = 'grid' | 'list'

function parseStatus(raw: string | null): CollectionStatusFilter {
  return STATUS_FILTERS.includes(raw as CollectionStatusFilter)
    ? (raw as CollectionStatusFilter)
    : CollectionStatusFilter.ALL
}

const CollectionsPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { session, restored, signIn } = useWallet()
  const address = session?.address

  const [searchParams, setSearchParams] = useSearchParams()
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const search = searchParams.get('q') ?? ''
  const status = parseStatus(searchParams.get('status'))
  const [view, setView] = useState<ViewMode>('grid')

  // The box updates on every keystroke; the URL (and with it the query) lags behind.
  const [searchInput, setSearchInput] = useState(search)
  const searchTimer = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => setSearchInput(search), [search])
  useEffect(() => () => clearTimeout(searchTimer.current), [])

  const collections = useCollections(address, { page, search, status })
  const { data: rejectedCount } = useRejectedCollectionsCount(address)

  // Filter/search/page changes all go through the URL, so back/forward and deep links just work.
  function changeParams(changes: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams)
    next.delete('page')
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    setSearchParams(next, { replace: true })
  }

  function onSearchChange(value: string) {
    setSearchInput(value)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => changeParams({ q: value.trim() || null }), SEARCH_DEBOUNCE_MS)
  }

  function goToPage(next: number) {
    const params = new URLSearchParams(searchParams)
    if (next > 1) params.set('page', String(next))
    else params.delete('page')
    setSearchParams(params, { replace: true })
    window.scrollTo({ top: 0 })
  }

  // The creation flow ships separately; until then the CTA signs a visitor in, and is inert once signed in.
  function onNewCollection() {
    if (!session) signIn()
  }

  const data = collections.data
  const total = data?.total ?? 0
  const pages = data?.pages ?? 0
  const shown = data?.results.length ?? 0
  const hasActiveFilters = !!search || status !== CollectionStatusFilter.ALL
  const isEmpty = !!data && total === 0 && !hasActiveFilters
  const noResults = !!data && total === 0 && hasActiveFilters
  const isLoading = !restored || (!!address && (collections.isLoading || (collections.isFetching && !data)))

  return (
    <S.Page data-testid="collections-page">
      <S.Header>
        <S.TitleRow>
          <S.BackButton type="button" aria-label={t('collections_page.back')} onClick={() => navigate('/overview')}>
            <ArrowBackIosNewIcon fontSize="small" />
          </S.BackButton>
          <S.Title>{t('collections_page.title')}</S.Title>
        </S.TitleRow>
        <S.HeaderActions>
          <S.SearchBox>
            <SearchIcon fontSize="small" />
            <input
              value={searchInput}
              placeholder={t('collections_page.search_placeholder')}
              aria-label={t('collections_page.search_placeholder')}
              data-testid="collections-search"
              onChange={e => onSearchChange(e.target.value)}
            />
          </S.SearchBox>
          <S.ActionButton
            type="button"
            data-variant="secondary"
            data-testid="open-editor"
            onClick={() => navigate('/collections/editor')}
          >
            <FormatShapesIcon fontSize="small" />
            {t('collections_page.open_editor')}
          </S.ActionButton>
          <S.ActionButton
            type="button"
            data-variant="primary"
            data-testid="new-collection"
            aria-disabled={!!session || undefined}
            title={session ? t('collections_page.coming_soon') : undefined}
            onClick={onNewCollection}
          >
            <AddIcon fontSize="small" />
            {t('collections_page.new_collection')}
          </S.ActionButton>
        </S.HeaderActions>
      </S.Header>

      <S.FilterRow>
        <S.Chips data-testid="status-filters">
          {STATUS_FILTERS.map(filter => (
            <S.Chip
              key={filter}
              type="button"
              data-active={status === filter || undefined}
              data-testid={`status-filter-${filter}`}
              onClick={() => changeParams({ status: filter === CollectionStatusFilter.ALL ? null : filter })}
            >
              {t(`collections_page.filter.${filter}`)}
              {filter === CollectionStatusFilter.REJECTED && !!rejectedCount && (
                <S.ChipBadge data-testid="rejected-count">{rejectedCount}</S.ChipBadge>
              )}
            </S.Chip>
          ))}
        </S.Chips>
        <S.ViewToggle role="group" aria-label={t('collections_page.view_mode')}>
          <S.ViewButton
            type="button"
            data-active={view === 'grid' || undefined}
            aria-pressed={view === 'grid'}
            aria-label={t('collections_page.view_grid')}
            data-testid="view-grid"
            onClick={() => setView('grid')}
          >
            <GridViewIcon fontSize="small" />
          </S.ViewButton>
          <S.ViewButton
            type="button"
            data-active={view === 'list' || undefined}
            aria-pressed={view === 'list'}
            aria-label={t('collections_page.view_list')}
            data-testid="view-list"
            onClick={() => setView('list')}
          >
            <FormatListBulletedIcon fontSize="small" />
          </S.ViewButton>
        </S.ViewToggle>
      </S.FilterRow>

      {restored && !session ? (
        <S.Panel data-testid="sign-in-panel">
          <S.SignInIcon aria-hidden>
            <PersonOutlineIcon />
          </S.SignInIcon>
          <S.PanelTitle>{t('collections_page.sign_in.title')}</S.PanelTitle>
          <S.ActionButton type="button" data-variant="primary" data-testid="sign-in" onClick={() => signIn()}>
            {t('collections_page.sign_in.action')}
          </S.ActionButton>
        </S.Panel>
      ) : isLoading ? (
        <S.Grid data-testid="collections-loading" aria-hidden>
          {Array.from({ length: 10 }, (_, i) => (
            <S.SkeletonCard key={i} className="skeleton" />
          ))}
        </S.Grid>
      ) : collections.isError ? (
        <S.Panel data-testid="collections-error">
          <S.PanelTitle>{t('collections_page.error.title')}</S.PanelTitle>
          <S.PanelText>{t('collections_page.error.description')}</S.PanelText>
          <S.ActionButton type="button" data-variant="secondary" onClick={() => void collections.refetch()}>
            {t('collections_page.error.retry')}
          </S.ActionButton>
        </S.Panel>
      ) : isEmpty ? (
        <S.Panel data-testid="collections-empty">
          <S.EmptyArt src={emptyCollectionsArt} alt="" />
          <S.PanelTitle>{t('collections_page.empty.title')}</S.PanelTitle>
          <S.PanelText data-desktop>{t('collections_page.empty.description')}</S.PanelText>
          <S.PanelText data-mobile>{t('collections_page.empty.description_mobile')}</S.PanelText>
          <S.EmptyActions>
            <S.ActionLink data-variant="secondary" href={LEARN_MORE_URL}>
              {t('collections_page.empty.learn_more')}
            </S.ActionLink>
            <S.ActionButton
              type="button"
              data-variant="primary"
              data-testid="create-first-collection"
              aria-disabled={!!session || undefined}
              title={session ? t('collections_page.coming_soon') : undefined}
              onClick={onNewCollection}
            >
              <AddIcon fontSize="small" />
              {t('collections_page.empty.create_first')}
            </S.ActionButton>
          </S.EmptyActions>
        </S.Panel>
      ) : noResults ? (
        <S.Panel data-testid="collections-no-results">
          <S.PanelTitle>{t('collections_page.no_results.title')}</S.PanelTitle>
          <S.PanelText>{t('collections_page.no_results.description')}</S.PanelText>
        </S.Panel>
      ) : (
        <>
          {view === 'grid' ? (
            <S.Grid data-testid="collections-grid">
              {data?.results.map(collection => (
                <CollectionCard key={collection.id} collection={collection} />
              ))}
            </S.Grid>
          ) : (
            <S.List data-testid="collections-list">
              <S.ListHeader>
                <span>{t('collections_page.list.collection')}</span>
                <span>{t('collections_page.list.items')}</span>
                <span>{t('collections_page.list.status')}</span>
                <span>{t('collections_page.list.last_updated')}</span>
                <span>{t('collections_page.list.created')}</span>
                <S.ListHeaderActions>{t('collections_page.list.actions')}</S.ListHeaderActions>
              </S.ListHeader>
              {data?.results.map(collection => (
                <CollectionListRow key={collection.id} collection={collection} />
              ))}
            </S.List>
          )}
          <S.FooterRow>
            <S.ShowingCount data-testid="collections-count">
              {t('collections_page.showing', { shown, total })}
            </S.ShowingCount>
            {pages > 1 && (
              <S.Pagination data-testid="collections-pagination">
                <S.PageButton
                  type="button"
                  aria-label={t('collections_page.previous_page')}
                  disabled={page <= 1}
                  onClick={() => goToPage(page - 1)}
                >
                  <ChevronLeftIcon fontSize="small" />
                </S.PageButton>
                {pageWindow(page, pages).map(n => (
                  <S.PageButton
                    key={n}
                    type="button"
                    data-current={n === page || undefined}
                    aria-current={n === page ? 'page' : undefined}
                    onClick={() => goToPage(n)}
                  >
                    {n}
                  </S.PageButton>
                ))}
                <S.PageButton
                  type="button"
                  aria-label={t('collections_page.next_page')}
                  disabled={page >= pages}
                  onClick={() => goToPage(page + 1)}
                >
                  <ChevronRightIcon fontSize="small" />
                </S.PageButton>
              </S.Pagination>
            )}
          </S.FooterRow>
        </>
      )}
    </S.Page>
  )
}

/** Up to 5 page numbers centred on the current page. */
function pageWindow(current: number, pages: number): number[] {
  const size = Math.min(5, pages)
  const start = Math.min(Math.max(1, current - 2), pages - size + 1)
  return Array.from({ length: size }, (_, i) => start + i)
}

export { CollectionsPage }

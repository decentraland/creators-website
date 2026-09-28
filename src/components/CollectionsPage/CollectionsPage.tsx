import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Add as AddIcon,
  FormatListBulleted as FormatListBulletedIcon,
  GridView as GridViewIcon,
  PersonOutline as PersonOutlineIcon,
  Search as SearchIcon
} from '@mui/icons-material'
import { useTranslation } from '~/intl'
import { clearTopUpResume, parseTopUpReturn, readTopUpResume, stripTopUpReturn } from '~/lib/creditsTopUp'
import { pageRangeLabel } from '~/lib/pagination'
import { useWallet } from '~/store/wallet'
import { COLLECTIONS_PAGE_SIZE, useCollections, useRejectedCollectionsCount } from '~/hooks/useCollections'
import { useSaveCollection } from '~/hooks/useCollection'
import { CollectionStatusFilter } from '~/lib/collections'
import { buildNewCollection } from '~/lib/saveCollection'
import { CollectionNameModal } from '~/components/CollectionNameModal'
import { Pagination } from '~/components/Pagination'
import emptyCollectionsArt from '~/assets/empty-collections.png'
import { Button } from '~/components/Button'
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

  // Stripe returns every credits purchase to this route; the hand-off record says which collection's
  // publish wizard it belongs to. Without one there is nothing to resume, so the params are dropped.
  const topUpReturn = useMemo(() => parseTopUpReturn(searchParams), [searchParams])
  useEffect(() => {
    if (!topUpReturn) return
    const resume = readTopUpResume()
    if (resume && resume.orderId === topUpReturn.orderId) {
      const params = new URLSearchParams({ order: topUpReturn.orderId })
      if (topUpReturn.canceled) params.set('canceled', '1')
      navigate({ pathname: `/collections/${resume.collectionId}`, search: `?${params}` }, { replace: true })
      return
    }
    clearTopUpResume()
    setSearchParams(prev => stripTopUpReturn(prev), { replace: true })
  }, [topUpReturn, navigate, setSearchParams])

  // The box updates on every keystroke; the URL (and with it the query) lags behind.
  const [searchInput, setSearchInput] = useState(search)
  const searchTimer = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => setSearchInput(search), [search])
  useEffect(() => () => clearTimeout(searchTimer.current), [])

  const collections = useCollections(address, { page, search, status })
  const { data: rejectedCount } = useRejectedCollectionsCount(address)

  const [isCreateOpen, setCreateOpen] = useState(false)
  const saveCollection = useSaveCollection(address)

  function closeCreateModal() {
    setCreateOpen(false)
    saveCollection.reset()
  }

  function onCreateSubmit(name: string) {
    if (!address) return
    saveCollection.mutate(buildNewCollection(name, address), {
      onSuccess: collection => navigate(`/collections/${collection.id}`)
    })
  }

  // Filter/search/page changes all go through the URL, so back/forward and deep links just work.
  // Functional updater: the debounced search callback would otherwise apply a stale snapshot and
  // revert a filter clicked inside the debounce window.
  function changeParams(changes: Record<string, string | null>) {
    setSearchParams(
      prev => {
        const next = new URLSearchParams(prev)
        next.delete('page')
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value)
          else next.delete(key)
        }
        return next
      },
      { replace: true }
    )
  }

  function onSearchChange(value: string) {
    setSearchInput(value)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => changeParams({ q: value.trim() || null }), SEARCH_DEBOUNCE_MS)
  }

  function goToPage(next: number) {
    changeParams({ page: next > 1 ? String(next) : null })
    window.scrollTo({ top: 0 })
  }

  function onNewCollection() {
    if (!session) signIn()
    else setCreateOpen(true)
  }

  const data = collections.data
  const total = data?.total ?? 0
  const pages = data?.pages ?? 0
  const shown = data?.results.length ?? 0
  const hasActiveFilters = !!search || status !== CollectionStatusFilter.ALL
  const isEmpty = !!data && total === 0 && !hasActiveFilters
  const noResults = !!data && total === 0 && hasActiveFilters
  const isLoading = !restored || (!!address && (collections.isLoading || (collections.isFetching && !data)))
  // Debounce window (input ahead of the URL) or a refetch with a search applied.
  const isSearching = searchInput.trim() !== search || (!!search && collections.isFetching)

  return (
    <S.Page data-testid="collections-page">
      <S.Header>
        <S.Title>{t('collections_page.title')}</S.Title>
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
            {isSearching && <S.Spinner data-testid="search-spinner" aria-hidden />}
          </S.SearchBox>
          <Button type="button" variant="primary" data-testid="new-collection" onClick={onNewCollection}>
            <AddIcon fontSize="small" />
            {t('collections_page.new_collection')}
          </Button>
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
          <Button type="button" variant="primary" data-testid="sign-in" onClick={() => signIn()}>
            {t('collections_page.sign_in.action')}
          </Button>
        </S.Panel>
      ) : isLoading ? (
        <S.Grid data-testid="collections-loading" aria-hidden>
          {Array.from({ length: COLLECTIONS_PAGE_SIZE }, (_, i) => (
            <S.SkeletonCard key={i} className="skeleton" />
          ))}
        </S.Grid>
      ) : collections.isError ? (
        <S.Panel data-testid="collections-error">
          <S.PanelTitle>{t('collections_page.error.title')}</S.PanelTitle>
          <S.PanelText>{t('collections_page.error.description')}</S.PanelText>
          <Button type="button" variant="secondary" onClick={() => void collections.refetch()}>
            {t('collections_page.error.retry')}
          </Button>
        </S.Panel>
      ) : isEmpty ? (
        <S.Panel data-testid="collections-empty">
          <S.EmptyArt src={emptyCollectionsArt} alt="" />
          <S.PanelTitle>{t('collections_page.empty.title')}</S.PanelTitle>
          <S.PanelText data-desktop>{t('collections_page.empty.description')}</S.PanelText>
          <S.PanelText data-mobile>{t('collections_page.empty.description_mobile')}</S.PanelText>
          <S.EmptyActions>
            <Button as="a" variant="secondary" href={LEARN_MORE_URL} target="_blank" rel="noopener noreferrer">
              {t('collections_page.empty.learn_more')}
            </Button>
            <Button type="button" variant="primary" data-testid="create-first-collection" onClick={onNewCollection}>
              <AddIcon fontSize="small" />
              {t('collections_page.empty.create_first')}
            </Button>
          </S.EmptyActions>
        </S.Panel>
      ) : noResults ? (
        <S.Panel data-testid="collections-no-results">
          <S.EmptyArt src={emptyCollectionsArt} alt="" />
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
              {t('collections_page.showing', { range: pageRangeLabel(page, COLLECTIONS_PAGE_SIZE, shown), total })}
            </S.ShowingCount>
            {pages > 1 && <Pagination page={page} pages={pages} onPageChange={goToPage} />}
          </S.FooterRow>
        </>
      )}

      {isCreateOpen && (
        <CollectionNameModal
          variant="create"
          isPending={saveCollection.isPending}
          error={saveCollection.error?.message ?? null}
          onSubmit={onCreateSubmit}
          onClose={closeCreateModal}
        />
      )}
    </S.Page>
  )
}

export { CollectionsPage }

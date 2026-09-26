import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PersonOutline as PersonOutlineIcon, Search as SearchIcon } from '@mui/icons-material'
import { useTranslation } from '~/intl'
import { Button } from '~/components/Button'
import { AssignCuratorModal } from '~/components/AssignCuratorModal'
import { NotFoundPage } from '~/components/NotFoundPage'
import { Pagination } from '~/components/Pagination'
import { Select, type SelectOption } from '~/components/Select'
import { shortAddress } from '~/components/ProfileBadge'
import { useCampaign } from '~/hooks/useCampaign'
import { useCommittee, useCurationCollections, useCurationsByCollection } from '~/hooks/useCuration'
import { useProfiles } from '~/hooks/useProfile'
import { track } from '~/lib/analytics'
import { type Collection } from '~/lib/collections'
import {
  ALL_ASSIGNEES,
  CURATION_PAGE_SIZE,
  CURATION_SORTS,
  CurationStatusFilter,
  orderCurators,
  parseCurationFilters,
  type CollectionCuration
} from '~/lib/curation'
import { pageRangeLabel } from '~/lib/pagination'
import { useWallet } from '~/store/wallet'
import { CurationRow } from './CurationRow'
import * as S from './CurationPage.styles'

const STATUS_FILTERS = Object.values(CurationStatusFilter)
const SEARCH_DEBOUNCE_MS = 500

type Assigning = { collection: Collection; curation: CollectionCuration | null; mode: 'self' | 'edit' }

const CurationPage = () => {
  const { t } = useTranslation()
  const { session, restored, signIn } = useWallet()
  const address = session?.address
  const committee = useCommittee(address)
  const campaign = useCampaign()

  const [searchParams, setSearchParams] = useSearchParams()
  const filters = useMemo(() => parseCurationFilters(searchParams), [searchParams])
  const collections = useCurationCollections(address, filters, committee.isCurator)
  const curations = useCurationsByCollection(address, committee.isCurator)
  const [assigning, setAssigning] = useState<Assigning | null>(null)

  const [searchInput, setSearchInput] = useState(filters.search)
  const searchTimer = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => setSearchInput(filters.search), [filters.search])
  useEffect(() => () => clearTimeout(searchTimer.current), [])

  const curators = useMemo(() => orderCurators(committee.members, address), [committee.members, address])
  const profiles = useProfiles(curators)
  const assigneeOptions = useMemo<SelectOption<string>[]>(
    () => [
      { value: ALL_ASSIGNEES, label: t('curation_page.filter.all_assignees') },
      ...curators.map((curator, index) => {
        const name = profiles[index]?.name || shortAddress(curator)
        return {
          value: curator,
          label: curator === address?.toLowerCase() ? t('curation_page.filter.you', { name }) : name,
          dividerBefore: index === 0
        }
      })
    ],
    [curators, profiles, address, t]
  )
  const sortOptions = useMemo<SelectOption<string>[]>(
    () => CURATION_SORTS.map(sort => ({ value: sort, label: t(`curation_page.sort.${sort}`) })),
    [t]
  )

  // Filters live in the URL so a review link can be shared and Back restores the list.
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

  function changeFilter(filter: string, value: string | null) {
    track('Curation filter changed', { filter, value: value ?? 'all' })
    changeParams({ [filter]: value })
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

  if (!restored || (session && committee.isLoading)) {
    return (
      <div className="page-loading" aria-busy="true" data-testid="curation-loading">
        <span className="spinner" aria-hidden />
      </div>
    )
  }

  if (!session) {
    return (
      <S.Page data-testid="curation-page">
        <S.Panel data-testid="sign-in-panel">
          <S.SignInIcon aria-hidden>
            <PersonOutlineIcon />
          </S.SignInIcon>
          <S.PanelTitle>{t('curation_page.sign_in')}</S.PanelTitle>
          <Button type="button" variant="primary" data-testid="sign-in" onClick={() => signIn()}>
            {t('collections_page.sign_in.action')}
          </Button>
        </S.Panel>
      </S.Page>
    )
  }

  if (!committee.isCurator) return <NotFoundPage />

  const data = collections.data
  const total = data?.total ?? 0
  const shown = data?.results.length ?? 0
  const hasActiveFilters =
    !!filters.search ||
    filters.status !== CurationStatusFilter.ALL ||
    filters.assignee !== ALL_ASSIGNEES ||
    !!filters.tag
  const isLoading = collections.isLoading || (collections.isFetching && !data)
  const isSearching = searchInput.trim() !== filters.search || (!!filters.search && collections.isFetching)

  return (
    <S.Page data-testid="curation-page">
      <S.Header>
        <S.Title>{t('curation_page.title')}</S.Title>
        <S.SearchBox>
          <SearchIcon fontSize="small" />
          <input
            value={searchInput}
            placeholder={t('curation_page.search_placeholder')}
            aria-label={t('curation_page.search_placeholder')}
            data-testid="curation-search"
            onChange={e => onSearchChange(e.target.value)}
          />
          {isSearching && <S.Spinner aria-hidden />}
        </S.SearchBox>
      </S.Header>

      <S.FilterRow>
        <S.Chips data-testid="curation-status-filters">
          {STATUS_FILTERS.map(status => (
            <S.Chip
              key={status}
              type="button"
              data-active={filters.status === status || undefined}
              data-testid={`curation-status-${status}`}
              onClick={() => changeFilter('status', status === CurationStatusFilter.ALL ? null : status)}
            >
              {t(`curation_page.filter.${status}`)}
            </S.Chip>
          ))}
          {campaign && (
            <S.Chip
              type="button"
              data-active={filters.tag === campaign.mainTag || undefined}
              aria-pressed={filters.tag === campaign.mainTag}
              data-testid="curation-campaign-filter"
              onClick={() => changeFilter('tag', filters.tag === campaign.mainTag ? null : campaign.mainTag)}
            >
              {campaign.name}
            </S.Chip>
          )}
        </S.Chips>
        <S.Selects>
          <Select
            value={filters.assignee}
            options={assigneeOptions}
            onChange={value => changeFilter('assignee', value === ALL_ASSIGNEES ? null : value)}
            ariaLabel={t('curation_page.filter.assignee')}
            testId="curation-assignee-filter"
          />
          <Select
            value={filters.sort}
            options={sortOptions}
            onChange={value => changeFilter('sort', value)}
            ariaLabel={t('curation_page.filter.sort')}
            testId="curation-sort"
          />
        </S.Selects>
      </S.FilterRow>

      {isLoading ? (
        <S.List data-testid="curation-loading-rows" aria-hidden>
          {Array.from({ length: 6 }, (_, i) => (
            <S.SkeletonRow key={i} className="skeleton" />
          ))}
        </S.List>
      ) : collections.isError ? (
        <S.Panel data-testid="curation-error">
          <S.PanelTitle>{t('curation_page.error.title')}</S.PanelTitle>
          <S.PanelText>{t('curation_page.error.description')}</S.PanelText>
          <Button type="button" variant="secondary" onClick={() => void collections.refetch()}>
            {t('curation_page.error.retry')}
          </Button>
        </S.Panel>
      ) : total === 0 ? (
        <S.Panel data-testid="curation-empty">
          <S.PanelTitle>{t(hasActiveFilters ? 'curation_page.no_results' : 'curation_page.empty')}</S.PanelTitle>
        </S.Panel>
      ) : (
        <>
          <S.List data-testid="curation-list">
            <S.ListHeader>
              <span>{t('curation_page.list.collection')}</span>
              <span>{t('curation_page.list.owner')}</span>
              <span>{t('curation_page.list.date')}</span>
              <span>{t('curation_page.list.last_update')}</span>
              <span>{t('curation_page.list.status')}</span>
              <span>{t('curation_page.list.assignee')}</span>
            </S.ListHeader>
            {data?.results.map(collection => (
              <CurationRow
                key={collection.id}
                collection={collection}
                curation={curations.byCollection.get(collection.id) ?? null}
                address={session.address}
                onAssign={(target, curation, mode) => setAssigning({ collection: target, curation, mode })}
              />
            ))}
          </S.List>
          <S.FooterRow>
            <S.ShowingCount data-testid="curation-count">
              {t('curation_page.showing', { range: pageRangeLabel(filters.page, CURATION_PAGE_SIZE, shown), total })}
            </S.ShowingCount>
            {(data?.pages ?? 0) > 1 && <Pagination page={filters.page} pages={data!.pages} onPageChange={goToPage} />}
          </S.FooterRow>
        </>
      )}

      {assigning && (
        <AssignCuratorModal
          collection={assigning.collection}
          curation={assigning.curation}
          address={session.address}
          mode={assigning.mode}
          onClose={() => setAssigning(null)}
        />
      )}
    </S.Page>
  )
}

export { CurationPage }

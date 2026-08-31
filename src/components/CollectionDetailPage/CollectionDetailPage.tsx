import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Add as AddIcon,
  ChevronLeft as ChevronLeftIcon,
  Edit as EditIcon,
  MoreVert as MoreVertIcon,
  PersonOutline as PersonOutlineIcon,
  Search as SearchIcon
} from '@mui/icons-material'
import { useIntl } from 'react-intl'
import { useTranslation } from '~/intl'
import { useWallet } from '~/store/wallet'
import { useCollection, useCollectionItems, useSaveCollection } from '~/hooks/useCollection'
import { BuilderServerError } from '~/lib/builder'
import { isCollectionLocked } from '~/lib/collections'
import { CollectionNameModal } from '~/components/CollectionNameModal'
import { CollectionStatusPill } from '~/components/CollectionStatusPill'
import { Pagination } from '~/components/Pagination'
import addItemsArt from '~/assets/add-items.png'
import { ItemListRow } from './ItemListRow'
import * as S from './CollectionDetailPage.styles'

const NOT_FOUND_STATUSES = [401, 403, 404]

const CollectionDetailPage = () => {
  const { t } = useTranslation()
  const intl = useIntl()
  const navigate = useNavigate()
  const { collectionId } = useParams()
  const { session, restored, signIn } = useWallet()
  const address = session?.address

  const [searchParams, setSearchParams] = useSearchParams()
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  // builder-server has no item-search param: the box filters the loaded page client-side.
  const [searchInput, setSearchInput] = useState('')

  const [isRenameOpen, setRenameOpen] = useState(false)

  const collectionQuery = useCollection(address, collectionId)
  const itemsQuery = useCollectionItems(address, collectionId, page)
  const saveCollection = useSaveCollection(address)

  const collection = collectionQuery.data
  const items = itemsQuery.data
  const total = items?.total ?? 0
  const pages = items?.pages ?? 0

  const query = searchInput.trim().toLowerCase()
  const results = items?.results ?? []
  const filtered = query ? results.filter(item => item.name.toLowerCase().includes(query)) : results

  const isLoading =
    !restored || (!!address && (collectionQuery.isLoading || (itemsQuery.isFetching && !items) || itemsQuery.isLoading))
  const isNotFound =
    collectionQuery.isError &&
    collectionQuery.error instanceof BuilderServerError &&
    NOT_FOUND_STATUSES.includes(collectionQuery.error.status)
  const isError = !isNotFound && (collectionQuery.isError || itemsQuery.isError)
  const isEmpty = !!collection && !!items && total === 0
  const canRename = !!collection && !collection.isPublished && !isCollectionLocked(collection)

  function goToPage(next: number) {
    setSearchParams(
      prev => {
        const params = new URLSearchParams(prev)
        if (next > 1) params.set('page', String(next))
        else params.delete('page')
        return params
      },
      { replace: true }
    )
    setSearchInput('')
    window.scrollTo({ top: 0 })
  }

  function closeRenameModal() {
    setRenameOpen(false)
    saveCollection.reset()
  }

  function onRenameSubmit(name: string) {
    if (!collection || name === collection.name) {
      closeRenameModal()
      return
    }
    saveCollection.mutate({ ...collection, name }, { onSuccess: closeRenameModal })
  }

  return (
    <S.Page data-testid="collection-detail-page">
      {restored && !session ? (
        <S.Panel data-testid="sign-in-panel">
          <S.SignInIconWrap aria-hidden>
            <PersonOutlineIcon />
          </S.SignInIconWrap>
          <S.PanelTitle>{t('collection_detail_page.sign_in.title')}</S.PanelTitle>
          <S.ActionButton type="button" data-variant="primary" data-testid="sign-in" onClick={() => signIn()}>
            {t('collection_detail_page.sign_in.action')}
          </S.ActionButton>
        </S.Panel>
      ) : isLoading ? (
        <>
          <S.SkeletonHeader className="skeleton" aria-hidden data-testid="collection-detail-loading" />
          <S.List aria-hidden>
            {Array.from({ length: 5 }, (_, i) => (
              <S.SkeletonRow key={i} className="skeleton" />
            ))}
          </S.List>
        </>
      ) : isNotFound ? (
        <S.Panel data-testid="collection-not-found">
          <S.PanelTitle>{t('collection_detail_page.not_found.title')}</S.PanelTitle>
          <S.PanelText>{t('collection_detail_page.not_found.description')}</S.PanelText>
          <S.ActionButton type="button" data-variant="secondary" onClick={() => navigate('/collections')}>
            {t('collection_detail_page.not_found.back')}
          </S.ActionButton>
        </S.Panel>
      ) : isError || !collection ? (
        <S.Panel data-testid="collection-detail-error">
          <S.PanelTitle>{t('collection_detail_page.error.title')}</S.PanelTitle>
          <S.PanelText>{t('collection_detail_page.error.description')}</S.PanelText>
          <S.ActionButton
            type="button"
            data-variant="secondary"
            onClick={() => {
              void collectionQuery.refetch()
              void itemsQuery.refetch()
            }}
          >
            {t('collection_detail_page.error.retry')}
          </S.ActionButton>
        </S.Panel>
      ) : (
        <>
          <S.Header>
            <S.HeaderLeft>
              <S.BackLink
                type="button"
                aria-label={t('collection_detail_page.back')}
                data-testid="back-to-collections"
                onClick={() => navigate('/collections')}
              >
                <ChevronLeftIcon />
              </S.BackLink>
              <S.Title title={collection.name}>{collection.name}</S.Title>
              {canRename && (
                <S.RenameButton
                  type="button"
                  aria-label={t('collection_detail_page.rename')}
                  data-testid="rename-collection"
                  onClick={() => setRenameOpen(true)}
                >
                  <EditIcon fontSize="small" />
                </S.RenameButton>
              )}
              <CollectionStatusPill collection={collection} />
            </S.HeaderLeft>
            <S.HeaderActions>
              <S.SearchBox>
                <SearchIcon fontSize="small" />
                <input
                  value={searchInput}
                  placeholder={t('collection_detail_page.search_placeholder')}
                  aria-label={t('collection_detail_page.search_placeholder')}
                  data-testid="items-search"
                  onChange={event => setSearchInput(event.target.value)}
                />
              </S.SearchBox>
              <S.ActionButton
                type="button"
                data-variant="secondary"
                data-testid="add-items"
                aria-disabled
                title={t('collection_detail_page.coming_soon')}
              >
                <AddIcon fontSize="small" />
                {t('collection_detail_page.add_items')}
              </S.ActionButton>
              <S.ActionButton
                type="button"
                data-variant="primary"
                data-testid="publish-collection"
                aria-disabled
                title={t('collection_detail_page.coming_soon')}
              >
                {t('collection_detail_page.publish')}
              </S.ActionButton>
              <S.MoreButton
                type="button"
                aria-label={t('collection_detail_page.more_actions')}
                aria-disabled
                title={t('collection_detail_page.coming_soon')}
                data-testid="collection-actions"
              >
                <MoreVertIcon fontSize="small" />
              </S.MoreButton>
            </S.HeaderActions>
          </S.Header>

          {isEmpty ? (
            <>
              <S.SectionLabel>{t('collection_detail_page.no_items')}</S.SectionLabel>
              <S.Dropzone data-testid="collection-empty">
                <S.DropArt src={addItemsArt} alt="" />
                <S.DropTitle>{t('collection_detail_page.empty.title')}</S.DropTitle>
                {/* Inert until the add-items flow ships; the copy still explains the desktop gesture. */}
                <S.DropText data-desktop title={t('collection_detail_page.coming_soon')}>
                  {intl.formatMessage(
                    { id: 'collection_detail_page.empty.description' },
                    { browse: chunks => <u>{chunks}</u> }
                  )}
                </S.DropText>
                <S.DropText data-mobile>{t('collection_detail_page.empty.description_mobile')}</S.DropText>
                <S.DropFormats>{t('collection_detail_page.empty.formats')}</S.DropFormats>
              </S.Dropzone>
            </>
          ) : (
            <>
              <S.SectionLabel data-testid="items-count">
                {t('collection_detail_page.items_count', { count: total })}
              </S.SectionLabel>
              {filtered.length === 0 ? (
                <S.Panel data-testid="items-no-results">
                  <S.PanelTitle>{t('collection_detail_page.no_results.title')}</S.PanelTitle>
                  <S.PanelText>{t('collection_detail_page.no_results.description')}</S.PanelText>
                </S.Panel>
              ) : (
                <S.List data-testid="items-list">
                  <S.ListHeader>
                    <span>{t('collection_detail_page.list.item')}</span>
                    <span>{t('collection_detail_page.list.body_type')}</span>
                    <span>{t('collection_detail_page.list.rarity')}</span>
                    <span>{t('collection_detail_page.list.category')}</span>
                    <span>{t('collection_detail_page.list.status')}</span>
                    <S.ListHeaderActions>{t('collection_detail_page.list.actions')}</S.ListHeaderActions>
                  </S.ListHeader>
                  {filtered.map(item => (
                    <ItemListRow key={item.id} item={item} />
                  ))}
                </S.List>
              )}
              <S.FooterRow>
                <S.ShowingCount data-testid="items-showing">
                  {/* The search filters only the loaded page, so the cross-page total would mislead. */}
                  {query
                    ? t('collection_detail_page.showing_filtered', { shown: filtered.length })
                    : t('collection_detail_page.showing', { shown: filtered.length, total })}
                </S.ShowingCount>
                {pages > 1 && <Pagination page={page} pages={pages} onPageChange={goToPage} />}
              </S.FooterRow>
            </>
          )}

          {isRenameOpen && (
            <CollectionNameModal
              variant="rename"
              initialName={collection.name}
              isPending={saveCollection.isPending}
              error={saveCollection.error?.message ?? null}
              onSubmit={onRenameSubmit}
              onClose={closeRenameModal}
            />
          )}
        </>
      )}
    </S.Page>
  )
}

export { CollectionDetailPage }

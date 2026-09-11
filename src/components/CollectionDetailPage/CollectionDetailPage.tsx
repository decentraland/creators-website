import { useCallback, useMemo, useRef, useState, type DragEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Add as AddIcon,
  ArrowBackIosNew as ArrowBackIcon,
  Edit as EditIcon,
  PersonOutline as PersonOutlineIcon
} from '@mui/icons-material'
import { useIntl } from 'react-intl'
import { useTranslation } from '~/intl'
import { useWallet } from '~/store/wallet'
import { ITEMS_PAGE_SIZE, useAllCollectionItems, useCollection, useSaveCollection } from '~/hooks/useCollection'
import { BuilderServerError } from '~/lib/builder'
import {
  CollectionDisplayStatus,
  canSellCollectionItems,
  getCollectionDisplayStatus,
  hasBeenApproved,
  isCollectionLocked
} from '~/lib/collections'
import { canSendCollectionItems } from '~/lib/mint'
import { ItemType, type Item } from '~/lib/items'
import {
  ITEM_TYPE_FILTERS,
  ItemTypeFilter,
  countItemsByType,
  filterItemsByType,
  paginateItems,
  parseItemTypeFilter
} from '~/lib/itemFilters'
import { MAX_PUBLISH_ITEMS, getPublishBlocker } from '~/lib/publishCollection'
import { useSyncPublishedItems } from '~/hooks/usePublishCollection'
import { useCollectionListings } from '~/hooks/useCollectionListings'
import { useItemSyncs } from '~/hooks/useItemSync'
import { hasPendingChanges } from '~/lib/itemSync'
import { previewCollection } from '~/lib/explorer'
import { pageRangeLabel } from '~/lib/pagination'
import { ITEM_EXTENSIONS } from '~/lib/itemFiles'
import { Button } from '~/components/Button'
import { Tooltip } from '~/components/Tooltip'
import { EmoteIcon, JumpInIcon, OpenEditorIcon, WearableIcon } from '~/components/Icons'
import { CollectionNameModal } from '~/components/CollectionNameModal'
import { CollectionRolePill } from '~/components/CollectionRolePill'
import { CollectionStatusPill } from '~/components/CollectionStatusPill'
import { Pagination } from '~/components/Pagination'
import addItemsArt from '~/assets/add-items.png'
import { CollectionActionsMenu } from '~/components/CollectionActionsMenu'
import { AddItemsModal } from './AddItemsModal'
import { ItemActionsMenu } from './ItemActionsMenu'
import { ItemListRow } from './ItemListRow'
import { PublishCollectionModal, PublishSuccessModal } from './PublishCollectionModal'
import { SellItemFlow } from './SellItemFlow'
import { SendItemsFlow } from './SendItemsFlow'
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
  const typeFilter = parseItemTypeFilter(searchParams.get('type'))

  const [isRenameOpen, setRenameOpen] = useState(false)
  const [publishView, setPublishView] = useState<'closed' | 'wizard' | 'success'>('closed')
  const [addItemsFiles, setAddItemsFiles] = useState<File[] | null>(null)
  const [isDragging, setDragging] = useState(false)
  const [isPreviewLaunching, setPreviewLaunching] = useState(false)
  const [sellingItem, setSellingItem] = useState<Item | null>(null)
  const filesInputRef = useRef<HTMLInputElement>(null)

  const collectionQuery = useCollection(address, collectionId)
  const itemsQuery = useAllCollectionItems(address, collectionId)
  const saveCollection = useSaveCollection(address)

  const collection = collectionQuery.data
  const allItems = itemsQuery.data
  const total = allItems?.length ?? 0
  const counts = useMemo(() => countItemsByType(allItems ?? []), [allItems])
  const {
    results,
    total: filteredTotal,
    pages
  } = useMemo(
    () => paginateItems(filterItemsByType(allItems ?? [], typeFilter), page, ITEMS_PAGE_SIZE),
    [allItems, typeFilter, page]
  )
  // Play Mode is an emote-only attribute; the column exists only while the visible page has emotes.
  const withPlayMode = useMemo(() => results.some(item => item.type === ItemType.EMOTE), [results])
  useSyncPublishedItems(address, collection, allItems ?? [])
  // Price, Sales and Sale Status exist once the collection is published; owners, collaborators and minters
  // can put items on sale once it has been approved at least once, even if it is under review again.
  const withMarket = !!collection?.isPublished
  const statusHint =
    collection && getCollectionDisplayStatus(collection) === CollectionDisplayStatus.UNDER_REVIEW
      ? t('collection_status.under_review_hint')
      : null
  const canSell = !!collection && hasBeenApproved(collection) && canSellCollectionItems(collection, address)
  const canSend = !!collection && canSendCollectionItems(collection, address)
  const [isSending, setSending] = useState(false)
  const listingsQuery = useCollectionListings(withMarket ? collection.contractAddress : undefined)
  const listings = listingsQuery.data
  // `undefined` keeps the price cell blank while the catalog loads; a failed request shows no price rather than an error.
  const listingFor = (item: Item) =>
    listings ? (listings.get(item.tokenId ?? '') ?? null) : listingsQuery.isError ? null : undefined
  const syncs = useItemSyncs(address, collection, allItems ?? [])

  const isLoading = !restored || (!!address && (collectionQuery.isLoading || itemsQuery.isLoading))
  const isNotFound =
    collectionQuery.isError &&
    collectionQuery.error instanceof BuilderServerError &&
    NOT_FOUND_STATUSES.includes(collectionQuery.error.status)
  const isError = !isNotFound && (collectionQuery.isError || itemsQuery.isError)
  const isEmpty = filteredTotal === 0
  const hasItems = total > 0
  const canRename = !!collection && !collection.isPublished && !isCollectionLocked(collection)
  const canAddItems = canRename
  const publishBlocker = collection ? getPublishBlocker(collection, total) : 'not_draft'

  function openFileBrowser() {
    filesInputRef.current?.click()
  }

  function startAddItems(files: FileList | File[] | null) {
    const list = files ? Array.from(files) : []
    if (list.length > 0) setAddItemsFiles(list)
  }

  const closeAddItems = useCallback(() => setAddItemsFiles(null), [])

  function onDropzoneDrop(event: DragEvent) {
    event.preventDefault()
    setDragging(false)
    if (canAddItems) startAddItems(event.dataTransfer.files)
  }

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
    window.scrollTo({ top: 0 })
  }

  function changeTypeFilter(next: ItemTypeFilter) {
    setSearchParams(
      prev => {
        const params = new URLSearchParams(prev)
        if (next === ItemTypeFilter.ALL) params.delete('type')
        else params.set('type', next)
        params.delete('page')
        return params
      },
      { replace: true }
    )
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
          <Button type="button" variant="primary" data-testid="sign-in" onClick={() => signIn()}>
            {t('collection_detail_page.sign_in.action')}
          </Button>
        </S.Panel>
      ) : isLoading ? (
        <S.Loading aria-hidden data-testid="collection-detail-loading">
          <S.Header>
            <S.HeaderLeft>
              <S.SkeletonTitle className="skeleton" />
            </S.HeaderLeft>
            <S.HeaderActions>
              <S.SkeletonButton className="skeleton" data-desktop-only />
              <S.SkeletonButton className="skeleton" data-desktop-only />
              <S.SkeletonButton className="skeleton" data-icon />
            </S.HeaderActions>
          </S.Header>
          <S.SubHeader>
            <S.FilterChips>
              <S.SkeletonChip className="skeleton" />
              <S.SkeletonChip className="skeleton" />
              <S.SkeletonChip className="skeleton" />
            </S.FilterChips>
            <S.SubActions>
              <S.SkeletonButton className="skeleton" data-compact />
              <S.SkeletonButton className="skeleton" data-compact />
            </S.SubActions>
          </S.SubHeader>
          <S.List>
            <S.SkeletonListHeader className="skeleton" />
            {Array.from({ length: 5 }, (_, i) => (
              <S.SkeletonRow key={i} className="skeleton" />
            ))}
          </S.List>
        </S.Loading>
      ) : isNotFound ? (
        <S.Panel data-testid="collection-not-found">
          <S.PanelTitle>{t('collection_detail_page.not_found.title')}</S.PanelTitle>
          <S.PanelText>{t('collection_detail_page.not_found.description')}</S.PanelText>
          <Button type="button" variant="secondary" onClick={() => navigate('/collections')}>
            {t('collection_detail_page.not_found.back')}
          </Button>
        </S.Panel>
      ) : isError || !collection ? (
        <S.Panel data-testid="collection-detail-error">
          <S.PanelTitle>{t('collection_detail_page.error.title')}</S.PanelTitle>
          <S.PanelText>{t('collection_detail_page.error.description')}</S.PanelText>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              void collectionQuery.refetch()
              void itemsQuery.refetch()
            }}
          >
            {t('collection_detail_page.error.retry')}
          </Button>
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
                <ArrowBackIcon />
              </S.BackLink>
              <S.TitleGroup>
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
              </S.TitleGroup>
              <CollectionStatusPill collection={collection} hint={statusHint} />
              {address && <CollectionRolePill collection={collection} address={address} />}
            </S.HeaderLeft>
            <S.HeaderActions>
              <Button
                type="button"
                variant="dark"
                disabled={!hasItems || isPreviewLaunching}
                data-desktop-only
                data-testid="preview-collection"
                onClick={() => {
                  setPreviewLaunching(true)
                  void previewCollection(collection.id).finally(() => setPreviewLaunching(false))
                }}
              >
                {t('collection_detail_page.preview')}
                <JumpInIcon />
              </Button>
              {publishBlocker !== 'not_draft' && (
                <Tooltip
                  content={
                    publishBlocker
                      ? t(`collection_detail_page.publish_blocker.${publishBlocker}`, { max: MAX_PUBLISH_ITEMS })
                      : null
                  }
                  placement="bottom"
                  asChild
                  testId="publish-blocker"
                >
                  <Button
                    type="button"
                    variant="primary"
                    data-desktop-only
                    data-testid="publish-collection"
                    aria-disabled={publishBlocker ? true : undefined}
                    onClick={() => !publishBlocker && setPublishView('wizard')}
                  >
                    {t('collection_detail_page.publish')}
                  </Button>
                </Tooltip>
              )}
              {canSend && (
                <Button
                  type="button"
                  variant="dark"
                  disabled={!hasItems}
                  data-desktop-only
                  data-testid="send-items"
                  onClick={() => setSending(true)}
                >
                  {t('collection_detail_page.send_items')}
                </Button>
              )}
              {address && (
                <CollectionActionsMenu
                  collection={collection}
                  address={address}
                  onSendItems={canSend ? () => setSending(true) : undefined}
                  onDeleted={() => navigate('/collections', { replace: true })}
                />
              )}
            </S.HeaderActions>
          </S.Header>

          <S.SubHeader>
            <S.FilterChips data-testid="type-filters">
              {ITEM_TYPE_FILTERS.map(filter => (
                <S.FilterChip
                  key={filter}
                  type="button"
                  data-active={typeFilter === filter || undefined}
                  data-testid={`type-filter-${filter}`}
                  onClick={() => changeTypeFilter(filter)}
                >
                  {filter === ItemTypeFilter.WEARABLE && <WearableIcon />}
                  {filter === ItemTypeFilter.EMOTE && <EmoteIcon />}
                  {t(`collection_detail_page.filter.${filter}`, { count: counts[filter] })}
                </S.FilterChip>
              ))}
            </S.FilterChips>
            <S.SubActions>
              <Button
                variant="secondary"
                type="button"
                data-testid="open-editor"
                onClick={() => navigate(`/collections/editor?collection=${collection.id}`)}
              >
                <OpenEditorIcon />
                {t('collection_detail_page.open_editor')}
              </Button>
              {canAddItems && (
                <Button variant="secondary" type="button" data-testid="add-items" onClick={openFileBrowser}>
                  <AddIcon fontSize="small" />
                  {t('collection_detail_page.add_items')}
                </Button>
              )}
            </S.SubActions>
          </S.SubHeader>

          {isEmpty && !canAddItems ? (
            <S.Panel data-testid="collection-no-items">
              <S.DropArt src={addItemsArt} alt="" />
              <S.PanelTitle>{t(`collection_detail_page.no_items.${typeFilter}`)}</S.PanelTitle>
              <S.PanelText>{t('collection_detail_page.no_items.description')}</S.PanelText>
            </S.Panel>
          ) : isEmpty ? (
            <>
              <S.Dropzone
                data-testid="collection-empty"
                data-dragging={isDragging || undefined}
                onDragOver={event => {
                  event.preventDefault()
                  if (canAddItems) setDragging(true)
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDropzoneDrop}
              >
                <S.DropArt src={addItemsArt} alt="" />
                <S.DropTitle data-desktop>{t('collection_detail_page.empty.title')}</S.DropTitle>
                <S.DropTitle data-mobile>{t('collection_detail_page.empty.title_mobile')}</S.DropTitle>
                <S.DropText data-desktop>
                  {intl.formatMessage(
                    { id: 'collection_detail_page.empty.description' },
                    {
                      browse: chunks => (
                        <S.BrowseLink type="button" data-testid="browse-files" onClick={openFileBrowser}>
                          {chunks}
                        </S.BrowseLink>
                      )
                    }
                  )}
                </S.DropText>
                <S.DropText data-mobile>{t('collection_detail_page.empty.description_mobile')}</S.DropText>
                <S.DropFormats>{t('collection_detail_page.empty.formats')}</S.DropFormats>
              </S.Dropzone>
            </>
          ) : (
            <>
              <S.List data-testid="items-list">
                <S.ListHeader
                  data-with-play-mode={withPlayMode || undefined}
                  data-with-market={withMarket || undefined}
                >
                  <span>{t('collection_detail_page.list.item')}</span>
                  <span>{t('collection_detail_page.list.body_shape')}</span>
                  <span>{t('collection_detail_page.list.category')}</span>
                  {withPlayMode && (
                    <span data-testid="list-header-play-mode">{t('collection_detail_page.list.play_mode')}</span>
                  )}
                  <span>{t('collection_detail_page.list.rarity')}</span>
                  {withMarket && (
                    <>
                      <span data-testid="list-header-price">{t('collection_detail_page.list.price')}</span>
                      <span data-testid="list-header-sales">{t('collection_detail_page.list.sales')}</span>
                      <span data-testid="list-header-sale-status">{t('collection_detail_page.list.sale_status')}</span>
                    </>
                  )}
                  <S.ListHeaderActions>{t('collection_detail_page.list.actions')}</S.ListHeaderActions>
                </S.ListHeader>
                {results.map(item => (
                  <ItemListRow
                    key={item.id}
                    item={item}
                    withPlayMode={withPlayMode}
                    withMarket={withMarket}
                    listing={withMarket ? listingFor(item) : undefined}
                    canSell={canSell && item.isPublished && !!item.tokenId}
                    onPutOnSale={setSellingItem}
                    contractAddress={collection.contractAddress}
                    actions={
                      address && (
                        <ItemActionsMenu
                          item={item}
                          collection={collection}
                          address={address}
                          sync={syncs.get(item.id)}
                          listing={withMarket ? listingFor(item) : undefined}
                        />
                      )
                    }
                  />
                ))}
              </S.List>
              <S.FooterRow>
                <S.ShowingCount data-testid="items-showing">
                  {t('collection_detail_page.showing', {
                    range: pageRangeLabel(page, ITEMS_PAGE_SIZE, results.length),
                    total: filteredTotal
                  })}
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

          <input
            ref={filesInputRef}
            type="file"
            multiple
            accept={ITEM_EXTENSIONS.join(',')}
            hidden
            data-testid="add-items-input"
            onChange={event => {
              startAddItems(event.target.files)
              event.target.value = ''
            }}
          />

          {addItemsFiles && address && (
            <AddItemsModal collection={collection} address={address} files={addItemsFiles} onClose={closeAddItems} />
          )}

          {publishView === 'wizard' && session && (
            <PublishCollectionModal
              collection={collection}
              session={session}
              onClose={() => setPublishView('closed')}
              onPublished={() => setPublishView('success')}
            />
          )}
          {publishView === 'success' && <PublishSuccessModal onDone={() => setPublishView('closed')} />}
          {isSending && session && (
            <SendItemsFlow
              collection={collection}
              items={allItems ?? []}
              session={session}
              onClose={() => setSending(false)}
            />
          )}
          {sellingItem && session && (
            <SellItemFlow
              item={sellingItem}
              collection={collection}
              session={session}
              hasPendingChanges={hasPendingChanges(syncs.get(sellingItem.id)?.status)}
              onClose={() => setSellingItem(null)}
            />
          )}
        </>
      )}
    </S.Page>
  )
}

export { CollectionDetailPage }

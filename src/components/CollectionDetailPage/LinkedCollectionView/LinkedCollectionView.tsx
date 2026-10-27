import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Add as AddIcon,
  ArrowBackIosNew as ArrowBackIcon,
  ContentCopy as ContentCopyIcon,
  Edit as EditIcon,
  ReportProblemOutlined as WarningIcon
} from '@mui/icons-material'
import { ContractNetwork } from '@dcl/schemas'
import { useTranslation } from '~/intl'
import { track } from '~/lib/analytics'
import { previewCollectionFromDetail } from '~/lib/explorer'
import { fetchAllLinkedCollectionItems, isRefusedRequest } from '~/lib/builder'
import { captureError } from '~/lib/monitoring'
import { isSocialLogin, sendContractTransaction, settleTransaction, type Session } from '~/lib/auth'
import { shortenAddress } from '~/lib/address'
import { copyToClipboard } from '~/lib/clipboard'
import { isCollectionLocked, type Collection } from '~/lib/collections'
import { ITEM_EXTENSIONS } from '~/lib/itemFiles'
import { type Item } from '~/lib/items'
import {
  LinkedItemFilter,
  getLinkedItemStatus,
  getLinkedPublishAction,
  isLinkedItemSelectable,
  linkedItemFilterToQuery,
  parseLinkedItemFilter,
  splitLinkedSelection,
  type ItemCuration
} from '~/lib/linkedItemStatus'
import { isContractInUseError } from '~/lib/linkedContract'
import { type Mappings } from '~/lib/mappings'
import { getMaticChainId } from '~/lib/publishCollection'
import {
  RelinkCancelledError,
  loadRelinkFrom,
  relinkCollection,
  storeRelinkFrom,
  type RelinkStep
} from '~/lib/relinkCollection'
import errorArt from '~/assets/modal-error.png'
import { ConfirmModal } from '~/components/ConfirmModal'
import { PendingModal } from '~/components/PendingModal'
import { SuccessModal } from '~/components/SuccessModal'

import { fetchRegisteredContracts } from '~/lib/thirdPartyRegistry'
import { useNotifications } from '~/lib/notifications'
import { pageRangeLabel } from '~/lib/pagination'
import { CurationStatus } from '~/lib/collections'
import {
  LINKED_COLLECTION_NAME_MAX_LENGTH,
  decodeLinkedUrn,
  isSameContract,
  withCollectionUrnSuffix,
  type LinkedContract,
  type ThirdParty
} from '~/lib/thirdParty'
import { useQueryClient } from '@tanstack/react-query'
import { useSaveCollection } from '~/hooks/useCollection'
import { invalidateCollectionItems } from '~/hooks/usePublishCollection'
import {
  LINKED_ITEMS_PAGE_SIZE,
  fetchDraftLinkedItems,
  thirdPartyKey,
  useHasLinkedWork,
  useItemCurations,
  useLinkedCollectionItems
} from '~/hooks/useLinkedCollection'
import { useMediaQuery } from '~/hooks/useMediaQuery'
import { useBeforeUnloadGuard } from '~/hooks/useBeforeUnloadGuard'
import { useSaveItem } from '~/hooks/useSaveItem'
import { createItemSaveQueue } from '~/lib/itemSaveQueue'
import { theme } from '~/styles/theme'
import { Button } from '~/components/Button'
import { CollectionActionsMenu } from '~/components/CollectionActionsMenu'
import { CollectionNameModal } from '~/components/CollectionNameModal'
import { CollectionStatusPill } from '~/components/CollectionStatusPill'
import { EditContractModal } from './EditContractModal'
import { EditUrnModal } from './EditUrnModal'
import { OpenEditorIcon } from '~/components/Icons'
import { Pagination } from '~/components/Pagination'
import { Tooltip } from '~/components/Tooltip'
import addItemsArt from '~/assets/add-items.png'
import { AddItemsModal } from '../AddItemsModal'
import * as P from '../CollectionDetailPage.styles'
import { LinkedItemActionsMenu } from './LinkedItemActionsMenu'
import { LinkedItemRow, nextMappingStates } from './LinkedItemRow'
import { PublishLinkedItemsModal } from './PublishLinkedItemsModal'
import { PushLinkedChangesModal } from './PushLinkedChangesModal'
import * as S from './LinkedCollectionView.styles'

type RelinkView =
  | { kind: 'form'; last?: LinkedContract }
  | { kind: 'running'; step: RelinkStep; to: LinkedContract }
  | { kind: 'success'; moved: number }
  | { kind: 'error'; inUse: boolean; to: LinkedContract }

const NETWORKS: string[] = Object.values(ContractNetwork)
// In the order an item goes through them.
const BASE_FILTERS = [
  LinkedItemFilter.ALL,
  LinkedItemFilter.DRAFT,
  LinkedItemFilter.UNDER_REVIEW,
  LinkedItemFilter.PUBLISHED,
  LinkedItemFilter.READY_TO_PUSH
]
const MIGRATION_FILTERS = [LinkedItemFilter.PENDING_MAPPING, LinkedItemFilter.PENDING_MIGRATION]

type Props = {
  collection: Collection
  thirdParty: ThirdParty | undefined
  session: Session
  page: number
  onBack: () => void
  onPageChange: (page: number) => void
}

/** A linked (third-party) collection: its contract, its items with their review status and token mapping, and the
 * actions to grow, publish and push it. */
export function LinkedCollectionView({ collection, thirdParty, session, page, onBack, onPageChange }: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { address } = session
  const showToast = useNotifications(state => state.showToast)
  const [searchParams, setSearchParams] = useSearchParams()
  const filter = parseLinkedItemFilter(searchParams.get('filter'))
  const compact = useMediaQuery(theme.media.noActions)
  const filesInputRef = useRef<HTMLInputElement>(null)

  const itemsPage = useLinkedCollectionItems(address, collection, page, filter)
  const items = useMemo(() => itemsPage.data?.results ?? [], [itemsPage.data])
  // Every item's latest curation: the rows read theirs, and a pending one anywhere blocks publishing.
  const curations = useItemCurations(address, collection)
  const saveCollection = useSaveCollection(address)
  const queryClient = useQueryClient()
  const saveItem = useSaveItem(address)
  const saveItemRef = useRef(saveItem)
  saveItemRef.current = saveItem
  const saveItemPatch = useMemo(
    () => createItemSaveQueue(item => saveItemRef.current.mutateAsync({ item })),
    // One queue per collection URN: a URN change rebuilds every item's URN, which the queue's copies would undo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [collection.id, collection.urn]
  )

  const [isRenameOpen, setRenameOpen] = useState(false)
  const [isUrnOpen, setUrnOpen] = useState(false)
  // The contract change: `from` is what the collection had when the dialog opened (a retry after a partial run still
  // knows what to replace), `view` which of its screens is up.
  const [relink, setRelink] = useState<{ from: LinkedContract | null; view: RelinkView } | null>(null)
  const runningView = relink?.view.kind === 'running' ? relink.view : null
  // Bumped when the user backs out of the wallet prompt: that run stops once the wallet answers, and is not shown.
  const relinkAttempt = useRef(0)
  // A run the user backed out of is still waiting on its wallet prompt; no other run may start until it settles.
  const [relinkInFlight, setRelinkInFlight] = useState(false)
  const errorView = relink?.view.kind === 'error' ? relink.view : null
  const [addItemsFiles, setAddItemsFiles] = useState<File[] | null>(null)
  const [bulkEditFiles, setBulkEditFiles] = useState<File[] | null>(null)
  const bulkInputRef = useRef<HTMLInputElement>(null)
  // Selected items by id, kept across pages: "Select all" can reach items that are not on screen.
  const [selected, setSelected] = useState<Map<string, Item>>(() => new Map())
  const [isSelectingAll, setSelectingAll] = useState(false)
  const [allAcrossSelected, setAllAcrossSelected] = useState(false)
  // What the wizard opened with: the live selection shifts as a partial failure refreshes the list, while the cheque
  // was signed for this set.
  const [publishView, setPublishView] = useState<
    { kind: 'closed' } | { kind: 'publish' | 'push'; toPublish: Item[]; toPush: Item[] }
  >({ kind: 'closed' })
  // Rows with a mapping edit not saved yet, by item, with the generation of the row that reported it last: publishing
  // now would send the old mapping, and a row already gone can't overrule a newer one.
  const [mappingStates, setMappingStates] = useState<ReadonlyMap<string, { dirty: boolean; generation: number }>>(
    () => new Map()
  )
  const unsavedMappings = useMemo(
    () => new Set([...mappingStates].filter(([, state]) => state.dirty).map(([itemId]) => itemId)),
    [mappingStates]
  )
  // Leaving the page within a mapping's save delay would drop the edit; leaving mid-relink leaves items behind.
  useBeforeUnloadGuard(unsavedMappings.size > 0 || relinkInFlight)
  const onMappingDirtyChange = useCallback((itemId: string, dirty: boolean, generation: number) => {
    setMappingStates(current => nextMappingStates(current, itemId, dirty, generation))
  }, [])

  const network = collection.linkedContractNetwork
  const contractAddress = collection.linkedContractAddress
  const contract = useMemo<LinkedContract | null>(
    () => (network && contractAddress ? { network: network as ContractNetwork, address: contractAddress } : null),
    [network, contractAddress]
  )
  const canEdit = !compact && !isCollectionLocked(collection)
  const canEditCollection = canEdit && !collection.isPublished
  const total = itemsPage.data?.total ?? 0
  const pages = itemsPage.data?.pages ?? 0
  const decodedUrn = decodeLinkedUrn(collection.urn)

  const tracked = useRef(false)
  useEffect(() => {
    if (tracked.current || !itemsPage.data) return
    tracked.current = true
    track('View linked collection', { collectionId: collection.id, item_count: itemsPage.data.total, network })
  }, [collection.id, itemsPage.data, network])

  // A filter shows another set of items: a selection made under the previous one would publish things off screen.
  const filterRef = useRef(filter)
  filterRef.current = filter
  useEffect(() => {
    setSelected(new Map())
    setAllAcrossSelected(false)
  }, [filter])

  const statuses = useMemo(
    () => new Map(items.map(item => [item.id, getLinkedItemStatus(item, curations.data?.get(item.id) ?? null)])),
    [items, curations.data]
  )
  const curationMap = useMemo(() => curations.data ?? new Map<string, ItemCuration>(), [curations.data])
  const selectableIds = useMemo(
    () =>
      curations.data
        ? items.filter(item => isLinkedItemSelectable(item, curationMap.get(item.id) ?? null)).map(item => item.id)
        : [],
    [items, curations.data, curationMap]
  )
  const selectableSet = useMemo(() => new Set(selectableIds), [selectableIds])
  // Selected items are kept as copies: refresh the ones on this page, so an edit since selecting is what publishes,
  // and drop the ones that can no longer be published or pushed.
  useEffect(() => {
    if (!curations.data) return
    setSelected(current => {
      let changed = false
      const next = new Map(current)
      for (const item of items) {
        if (!next.has(item.id)) continue
        if (!selectableSet.has(item.id)) next.delete(item.id)
        else if (next.get(item.id) !== item) next.set(item.id, item)
        else continue
        changed = true
      }
      return changed ? next : current
    })
  }, [items, selectableSet, curations.data])
  const selection = useMemo(() => splitLinkedSelection(selected.values(), curationMap), [selected, curationMap])
  const selectedCount = selection.toPublish.length + selection.toPush.length
  const publishAction = getLinkedPublishAction(selection)
  // Nothing anywhere to publish or push: the button would only ever be disabled, so it isn't shown.
  const hasWork = useHasLinkedWork(address, collection, curations.data)
  const hasPendingReview = useMemo(
    () => [...(curations.data?.values() ?? [])].some(curation => curation.status === CurationStatus.PENDING),
    [curations.data]
  )
  const publishBlocker = !publishAction
    ? 'no_selection'
    : publishAction !== 'push' && hasPendingReview
      ? 'under_review'
      : unsavedMappings.size > 0
        ? 'saving_mappings'
        : null
  const pageSelected = useMemo(() => selectableIds.filter(id => selected.has(id)).length, [selectableIds, selected])
  const allPageSelected = selectableIds.length > 0 && pageSelected === selectableIds.length
  const headerCheckbox = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (headerCheckbox.current) headerCheckbox.current.indeterminate = pageSelected > 0 && !allPageSelected
  }, [pageSelected, allPageSelected])
  const canSelectAcross = allPageSelected && !allAcrossSelected && pages > 1

  const filters = collection.isMappingComplete === false ? [...BASE_FILTERS, ...MIGRATION_FILTERS] : BASE_FILTERS

  function changeFilter(next: LinkedItemFilter) {
    setSearchParams(
      prev => {
        const params = new URLSearchParams(prev)
        if (next === LinkedItemFilter.ALL) params.delete('filter')
        else params.set('filter', next)
        params.delete('page')
        return params
      },
      { replace: true }
    )
  }

  function toggleSelected(item: Item, isSelected: boolean) {
    setAllAcrossSelected(false)
    setSelected(current => {
      const next = new Map(current)
      if (isSelected) next.set(item.id, item)
      else next.delete(item.id)
      return next
    })
  }

  function togglePage(isSelected: boolean) {
    setAllAcrossSelected(false)
    setSelected(current => {
      const next = new Map(current)
      for (const item of items) {
        if (!selectableSet.has(item.id)) continue
        if (isSelected) next.set(item.id, item)
        else next.delete(item.id)
      }
      return next
    })
  }

  function clearSelection() {
    setAllAcrossSelected(false)
    setSelected(new Map())
  }

  async function selectAllAcross() {
    const startedWith = filter
    setSelectingAll(true)
    try {
      const all =
        filter === LinkedItemFilter.DRAFT
          ? await fetchDraftLinkedItems(address, collection.id)
          : await fetchAllLinkedCollectionItems(address, collection.id, linkedItemFilterToQuery(filter))
      // The filter changed while this loaded: these items belong to the previous one.
      if (filterRef.current !== startedWith) return
      const selectable = all.filter(item => isLinkedItemSelectable(item, curationMap.get(item.id) ?? null))
      setSelected(new Map(selectable.map(item => [item.id, item])))
      setAllAcrossSelected(true)
      track('Select all linked items', { collectionId: collection.id, filter, count: selectable.length })
    } catch (error) {
      captureError(error, { flow: 'linked_select_all', collectionId: collection.id })
      showToast(t('linked_collection.select_all_error'), { type: 'error' })
    } finally {
      setSelectingAll(false)
    }
  }

  async function copyContract() {
    if (!contractAddress) return
    track('Copy linked contract address', { collectionId: collection.id, network })
    if (await copyToClipboard(contractAddress)) showToast(t('linked_collection.contract_copied'))
    else showToast(t('collection_detail_page.actions.copy_failed'), { type: 'error' })
  }

  function closeRename() {
    setRenameOpen(false)
    saveCollection.reset()
  }

  function openContract() {
    if (contract) setRelink({ from: loadRelinkFrom(collection.id) ?? contract, view: { kind: 'form' } })
  }

  function closeContract() {
    setRelink(null)
  }

  async function relinkContract(next: LinkedContract) {
    if (!thirdParty || !relink) return
    const { from } = relink
    const attempt = ++relinkAttempt.current
    const show = (view: RelinkView) => {
      if (relinkAttempt.current === attempt) setRelink({ from, view })
    }
    setRelinkInFlight(true)
    try {
      const chainId = getMaticChainId()
      if (from && !isSameContract(from, next)) storeRelinkFrom(collection.id, from)
      const { moved } = await relinkCollection(
        {
          saveCollection: saveCollection.mutateAsync,
          fetchRegisteredContracts: () => fetchRegisteredContracts(chainId, thirdParty.id),
          sendTransaction: call => sendContractTransaction(session, call),
          settleTransaction: txHash => settleTransaction(chainId, txHash),
          fetchItems: () => fetchAllLinkedCollectionItems(address, collection.id),
          saveItem: saveItemPatch,
          onStep: step => show({ kind: 'running', step, to: next }),
          isCancelled: () => relinkAttempt.current !== attempt
        },
        { chainId, collection, thirdParty, from, to: next }
      )
      track('Edit TP Collection Contract', { collectionId: collection.id, from, to: next, items: moved })
      storeRelinkFrom(collection.id, null)
      void curations.refetch()
      show({ kind: 'success', moved })
    } catch (error) {
      if (!(error instanceof RelinkCancelledError)) {
        const inUse = isContractInUseError(error)
        if (!inUse) captureError(error, { flow: 'linked_collection_contract', collectionId: collection.id })
        show({ kind: 'error', inUse, to: next })
      }
    } finally {
      // A run that stopped halfway has already changed the collection, the registry or some items.
      void queryClient.invalidateQueries({ queryKey: thirdPartyKey(address, thirdParty.id) })
      invalidateCollectionItems(queryClient, collection.id)
      setRelinkInFlight(false)
    }
  }

  function closeUrn() {
    setUrnOpen(false)
    saveCollection.reset()
  }

  function saveUrn(suffix: string) {
    const next = withCollectionUrnSuffix(collection, suffix)
    saveCollection.mutate(next, {
      onSuccess: () => {
        track('Change TP Collection URN', { oldURN: collection.urn, newURN: next.urn })
        // builder-server rebuilds every item URN from the collection's, so the cached items carry the old one.
        invalidateCollectionItems(queryClient, collection.id)
        closeUrn()
        showToast(t('linked_collection.urn_saved'))
      },
      onError: error => {
        if (!isRefusedRequest(error))
          captureError(error, { flow: 'linked_collection_urn', collectionId: collection.id })
      }
    })
  }

  const saveMappings = useCallback(
    (item: Item, mappings: Mappings) =>
      saveItemPatch(item, { mappings })
        .then(saved => {
          track('Edit Item Mapping', {
            itemId: item.id,
            mappingType: Object.values(mappings)[0]?.[contractAddress?.toLowerCase() ?? '']?.[0]?.type
          })
          return saved
        })
        .catch((error: unknown) => {
          captureError(error, { flow: 'linked_mapping_save', collectionId: collection.id, itemId: item.id })
          showToast(t('linked_collection.mapping_error', { name: item.name }), { type: 'error' })
          throw error
        }),
    [saveItemPatch, showToast, t, contractAddress, collection.id]
  )

  function startAddItems(files: FileList | File[] | null) {
    const list = files ? Array.from(files) : []
    if (list.length > 0) setAddItemsFiles(list)
  }

  const closePublish = useCallback(() => setPublishView({ kind: 'closed' }), [])
  const onPublished = useCallback(() => {
    setSelected(new Map())
    setAllAcrossSelected(false)
    void curations.refetch()
    void itemsPage.refetch()
  }, [curations, itemsPage])

  // A failed load has no total: it must not read as an empty collection.
  const loadFailed = itemsPage.isError && !itemsPage.data
  const isEmpty = !itemsPage.isLoading && !loadFailed && total === 0

  return (
    <>
      <P.Header>
        <P.HeaderLeft>
          <P.BackLink
            type="button"
            aria-label={t('collection_detail_page.back')}
            data-testid="back-to-collections"
            onClick={onBack}
          >
            <ArrowBackIcon />
          </P.BackLink>
          <P.TitleGroup>
            <P.Title title={collection.name}>{collection.name}</P.Title>
            {canEditCollection && (
              <P.RenameButton
                type="button"
                aria-label={t('collection_detail_page.rename')}
                data-testid="rename-collection"
                onClick={() => setRenameOpen(true)}
              >
                <EditIcon fontSize="small" />
              </P.RenameButton>
            )}
          </P.TitleGroup>
          <CollectionStatusPill collection={collection} />
        </P.HeaderLeft>
        <P.HeaderActions>
          {hasWork && (
            <Tooltip
              content={publishBlocker ? t(`linked_collection.publish_blocker.${publishBlocker}`) : null}
              placement="bottom"
              asChild
              testId="linked-publish-blocker"
            >
              <Button
                type="button"
                variant="primary"
                data-desktop-only
                data-testid="publish-linked-items"
                aria-disabled={publishBlocker ? true : undefined}
                onClick={() => {
                  if (publishBlocker || !publishAction) return
                  setPublishView({
                    kind: publishAction === 'push' ? 'push' : 'publish',
                    toPublish: selection.toPublish,
                    toPush: selection.toPush
                  })
                }}
              >
                {t(`linked_collection.publish_action.${publishAction ?? 'publish'}`, { count: selectedCount })}
              </Button>
            </Tooltip>
          )}
          <CollectionActionsMenu
            collection={collection}
            address={address}
            showRoles={false}
            onPreviewInWorld={total > 0 ? () => previewCollectionFromDetail(collection.id, total) : undefined}
            onPreviewItems={() => navigate(`/collections/editor?collection=${collection.id}`)}
            onEditUrn={canEditCollection ? () => setUrnOpen(true) : undefined}
            onEditContract={
              // A mapping edit still waiting to save would write the old contract back after the change.
              canEdit && contract && thirdParty && unsavedMappings.size === 0 ? openContract : undefined
            }
            onEditInBulk={canEdit && total > 0 ? () => bulkInputRef.current?.click() : undefined}
            onDeleted={() => navigate('/collections', { replace: true })}
          />
        </P.HeaderActions>
      </P.Header>

      <S.ContractRow data-testid="linked-contract">
        {thirdParty?.name && (
          <S.ContractField>
            <S.ContractLabel>{t('linked_collection.third_party')}</S.ContractLabel>
            <S.ContractValue data-testid="linked-third-party">{thirdParty.name}</S.ContractValue>
          </S.ContractField>
        )}
        {/* A virtual third party has no kind yet: it is chosen in its first publish. */}
        {thirdParty && (thirdParty.published || thirdParty.isProgrammatic) && (
          <S.ContractField>
            <S.ContractLabel>{t('linked_collection.kind_label')}</S.ContractLabel>
            <S.ContractValue data-testid="third-party-kind">
              {t(`linked_collection.kind.${thirdParty.isProgrammatic ? 'programmatic' : 'standard'}`)}
            </S.ContractValue>
          </S.ContractField>
        )}
        {network && (
          <S.ContractField>
            <S.ContractLabel>{t('linked_collection.network')}</S.ContractLabel>
            <S.ContractValue data-testid="linked-network">
              {NETWORKS.includes(network) ? t(`linked_collection.networks.${network}`) : network}
            </S.ContractValue>
          </S.ContractField>
        )}
        {contractAddress && (
          <S.ContractField>
            <S.ContractLabel>{t('linked_collection.contract')}</S.ContractLabel>
            <S.ContractValue data-testid="linked-contract-address" title={contractAddress}>
              {shortenAddress(contractAddress)}
              <S.CopyButton
                type="button"
                aria-label={t('linked_collection.copy_contract')}
                data-testid="copy-linked-contract"
                onClick={() => void copyContract()}
              >
                <ContentCopyIcon fontSize="small" />
              </S.CopyButton>
            </S.ContractValue>
          </S.ContractField>
        )}
      </S.ContractRow>

      {collection.isMappingComplete === false && (
        <S.Banner data-testid="linked-migration-banner">
          <WarningIcon fontSize="small" />
          {t('linked_collection.migration_banner')}
        </S.Banner>
      )}

      <P.SubHeader>
        <P.FilterChips data-testid="linked-filters">
          {filters.map(value => (
            <P.FilterChip
              key={value}
              type="button"
              data-active={filter === value || undefined}
              data-testid={`linked-filter-${value}`}
              onClick={() => changeFilter(value)}
            >
              {t(`linked_collection.filter.${value}`)}
            </P.FilterChip>
          ))}
        </P.FilterChips>
        <P.SubActions>
          <Button
            variant="secondary"
            type="button"
            data-testid="open-editor"
            onClick={() => navigate(`/collections/editor?collection=${collection.id}`)}
          >
            <OpenEditorIcon />
            {t('collection_detail_page.open_editor')}
          </Button>
          {canEdit && (
            <Button
              variant="secondary"
              type="button"
              data-testid="add-items"
              onClick={() => filesInputRef.current?.click()}
            >
              <AddIcon fontSize="small" />
              {t('collection_detail_page.add_items')}
            </Button>
          )}
        </P.SubActions>
      </P.SubHeader>

      {loadFailed ? (
        <P.Panel data-testid="linked-items-error">
          <P.PanelTitle>{t('linked_collection.load_error.title')}</P.PanelTitle>
          <P.PanelText>{t('linked_collection.load_error.description')}</P.PanelText>
          <Button
            type="button"
            variant="secondary"
            data-testid="linked-items-retry"
            onClick={() => void itemsPage.refetch()}
          >
            {t('linked_collection.load_error.retry')}
          </Button>
        </P.Panel>
      ) : isEmpty && filter === LinkedItemFilter.ALL ? (
        <P.Panel data-testid="collection-empty">
          <P.DropArt src={addItemsArt} alt="" />
          <P.PanelTitle>{t('linked_collection.empty.title')}</P.PanelTitle>
          <P.PanelText>{t('linked_collection.empty.description')}</P.PanelText>
          {canEdit && (
            <Button
              type="button"
              variant="primary"
              data-testid="add-first-items"
              onClick={() => filesInputRef.current?.click()}
            >
              <AddIcon fontSize="small" />
              {t('collection_detail_page.add_items')}
            </Button>
          )}
        </P.Panel>
      ) : isEmpty ? (
        <P.Panel data-testid="collection-no-items">
          <P.PanelTitle>{t('linked_collection.no_results.title')}</P.PanelTitle>
          <P.PanelText>{t('linked_collection.no_results.description')}</P.PanelText>
        </P.Panel>
      ) : (
        <>
          <S.List data-testid="items-list" aria-busy={itemsPage.isFetching || undefined}>
            <S.ListHeader data-selecting={selectedCount > 0 || undefined}>
              <S.HeaderSelect>
                <input
                  ref={headerCheckbox}
                  type="checkbox"
                  checked={allPageSelected}
                  disabled={selectableIds.length === 0 || isSelectingAll}
                  aria-label={t('linked_collection.select_all')}
                  data-testid="linked-select-all"
                  onChange={event => togglePage(event.target.checked)}
                />
              </S.HeaderSelect>
              {selectedCount > 0 ? (
                <S.SelectionSummary data-testid="linked-selection">
                  <S.SelectionCount data-testid="linked-selection-count">
                    {t(allAcrossSelected ? 'linked_collection.selected_all' : 'linked_collection.selected', {
                      count: selectedCount
                    })}
                  </S.SelectionCount>
                  <S.SelectionActions>
                    {canSelectAcross && (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        loading={isSelectingAll}
                        data-testid="linked-select-across"
                        onClick={() => void selectAllAcross()}
                      >
                        {t('linked_collection.select_across', { total })}
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="dark"
                      disabled={isSelectingAll}
                      data-testid="linked-clear-selection"
                      onClick={clearSelection}
                    >
                      {t('linked_collection.clear_selection')}
                    </Button>
                  </S.SelectionActions>
                </S.SelectionSummary>
              ) : (
                <>
                  <span data-name>{t('collection_detail_page.list.item')}</span>
                  <span>{t('collection_detail_page.list.category')}</span>
                  <span>
                    {t('linked_collection.list.status')}
                    {curations.isError && (
                      <S.StatusRetry
                        type="button"
                        data-testid="linked-item-status-retry"
                        disabled={curations.isFetching}
                        onClick={() => void curations.refetch()}
                      >
                        {t('linked_collection.item_status.retry')}
                      </S.StatusRetry>
                    )}
                  </span>
                  <span>{t('linked_collection.list.mapping')}</span>
                  <span>{t('collection_detail_page.list.actions')}</span>
                </>
              )}
            </S.ListHeader>
            {items.map(item => (
              <LinkedItemRow
                key={item.id}
                item={item}
                contract={contract}
                status={curations.isSuccess ? statuses.get(item.id) : undefined}
                selectable={selectableSet.has(item.id)}
                selected={selected.has(item.id)}
                onSelectedChange={isSelected => toggleSelected(item, isSelected)}
                editable={canEdit}
                onSaveMappings={saveMappings}
                onMappingDirtyChange={onMappingDirtyChange}
                actions={
                  <LinkedItemActionsMenu
                    onDeleted={() => toggleSelected(item, false)}
                    item={item}
                    collection={collection}
                    address={address}
                    curation={curations.isSuccess ? (curations.data.get(item.id) ?? null) : undefined}
                    canEdit={canEdit}
                    saveItemPatch={saveItemPatch}
                  />
                }
              />
            ))}
          </S.List>
          <P.FooterRow>
            <P.ShowingCount data-testid="items-showing">
              {t('collection_detail_page.showing', {
                range: pageRangeLabel(page, LINKED_ITEMS_PAGE_SIZE, items.length),
                total
              })}
            </P.ShowingCount>
            {pages > 1 && <Pagination page={page} pages={pages} onPageChange={onPageChange} />}
          </P.FooterRow>
        </>
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

      <input
        ref={bulkInputRef}
        type="file"
        multiple
        accept=".zip"
        hidden
        data-testid="edit-in-bulk-input"
        onChange={event => {
          const list = event.target.files ? Array.from(event.target.files) : []
          if (list.length > 0) setBulkEditFiles(list)
          event.target.value = ''
        }}
      />
      {bulkEditFiles && (
        <AddItemsModal
          collection={collection}
          address={address}
          files={bulkEditFiles}
          updateOnly
          onClose={() => setBulkEditFiles(null)}
        />
      )}
      {addItemsFiles && (
        <AddItemsModal
          collection={collection}
          address={address}
          files={addItemsFiles}
          onClose={() => setAddItemsFiles(null)}
        />
      )}
      {isRenameOpen && (
        <CollectionNameModal
          variant="rename"
          initialName={collection.name}
          nameMaxLength={LINKED_COLLECTION_NAME_MAX_LENGTH}
          isPending={saveCollection.isPending}
          error={saveCollection.error?.message ?? null}
          onSubmit={name => {
            if (name === collection.name) return closeRename()
            saveCollection.mutate({ ...collection, name }, { onSuccess: closeRename })
          }}
          onClose={closeRename}
        />
      )}
      {isUrnOpen && decodedUrn && (
        <EditUrnModal
          kind="collection"
          urnPrefix={decodedUrn.thirdPartyId}
          initialSuffix={decodedUrn.collectionSuffix}
          isPending={saveCollection.isPending}
          error={saveCollection.isError ? t('linked_collection.urn_error') : null}
          onSubmit={saveUrn}
          onClose={closeUrn}
        />
      )}
      {relink && (relink.view.kind === 'form' || (relink.view.kind === 'running' && isSocialLogin(session))) && (
        <EditContractModal
          initial={relink.view.kind === 'form' ? relink.view.last : relink.view.to}
          isPending={relink.view.kind === 'running' || relinkInFlight}
          onSubmit={next => void relinkContract(next)}
          onClose={closeContract}
        />
      )}
      {relink && runningView && !isSocialLogin(session) && (
        <PendingModal
          label={t(
            runningView.step === 'signing' ? 'sell_item_modal.confirm_in_wallet' : 'edit_contract_modal.running.working'
          )}
          onCancel={
            runningView.step === 'signing'
              ? () => {
                  relinkAttempt.current++
                  setRelink({ from: relink.from, view: { kind: 'form', last: runningView.to } })
                }
              : undefined
          }
          testId="edit-contract-running"
        />
      )}
      {relink?.view.kind === 'success' && (
        <SuccessModal
          title={t('edit_contract_modal.success.title')}
          description={t('edit_contract_modal.success.body', { count: relink.view.moved })}
          onDone={closeContract}
        />
      )}
      {relink && errorView && (
        <ConfirmModal
          title={t('edit_contract_modal.error.title')}
          description={t(
            errorView.inUse ? 'create_linked_collection_modal.error_contract_in_use' : 'edit_contract_modal.error.body'
          )}
          art={{ src: errorArt }}
          onClose={closeContract}
          cancel={{
            label: t('publish_collection_modal.error.cancel'),
            onClick: closeContract,
            testId: 'edit-contract-error-cancel'
          }}
          confirm={{
            label: t('publish_collection_modal.error.try_again'),
            onClick: () => setRelink({ from: relink.from, view: { kind: 'form', last: errorView.to } }),
            testId: 'edit-contract-error-retry'
          }}
          testId="edit-contract-error"
        />
      )}
      {publishView.kind === 'publish' && thirdParty && (
        <PublishLinkedItemsModal
          collection={collection}
          thirdParty={thirdParty}
          session={session}
          itemsToPublish={publishView.toPublish}
          itemsToPush={publishView.toPush}
          onClose={closePublish}
          onPublished={onPublished}
        />
      )}
      {publishView.kind === 'push' && (
        <PushLinkedChangesModal
          collection={collection}
          session={session}
          items={publishView.toPush}
          onClose={closePublish}
          onPushed={onPublished}
        />
      )}
    </>
  )
}

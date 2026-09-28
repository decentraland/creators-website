import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { BodyShape, PreviewRenderer, type IPreviewController } from '@dcl/schemas'
import { PersonOutline as PersonOutlineIcon } from '@mui/icons-material'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { AvatarPreview } from '~/components/AvatarPreview'
import { Button } from '~/components/Button'
import { AddItemsModal } from '~/components/CollectionDetailPage/AddItemsModal'
import { CollectionNameModal } from '~/components/CollectionNameModal'
import { ConfirmModal } from '~/components/ConfirmModal'
import { ZoomControls } from '~/components/ZoomControls'
import { useBaseWearables } from '~/hooks/useBaseWearables'
import { useBeforeUnloadGuard } from '~/hooks/useBeforeUnloadGuard'
import { allCollectionItemsKey, useAllCollectionItems, useCollection, useSaveCollection } from '~/hooks/useCollection'
import { useMediaQuery } from '~/hooks/useMediaQuery'
import { useModelValidation } from '~/hooks/useModelValidation'
import { usePreviewRenderer } from '~/hooks/usePreviewRenderer'
import { useSaveItem } from '~/hooks/useSaveItem'
import { useSpringBones } from '~/hooks/useSpringBones'
import { useTranslation } from '~/intl'
import { type AvatarAttributes } from '~/lib/avatar'
import { BuilderServerError, COLLECTION_LOCKED_STATUS } from '~/lib/builder'
import { canManageCollectionItems, hasCollectionRole, isCollectionLocked, type Collection } from '~/lib/collections'
import { parseUuidParam } from '~/lib/ids'
import { toPreviewItem, toSaveableItem } from '~/lib/itemDraft'
import { getEditorMode, pickDressedItems, resolveSelectedItem } from '~/lib/itemEditor'
import { pickFiles } from '~/lib/filePicker'
import { ITEM_EXTENSIONS } from '~/lib/itemFiles'
import { ItemType, canEditItemDetails, isSocialEmote, type Item } from '~/lib/items'
import { useNotifications } from '~/lib/notifications'
import { type AvatarPreviewSource } from '~/lib/preview'
import { getShapesMissingSpringBones, mergeSpringBonesIntoItem, type SpringBoneParamsByName } from '~/lib/springBones'
import { selectAvatarAttributes, useAvatarPreview } from '~/store/avatarPreview'
import { useWallet } from '~/store/wallet'
import { theme } from '~/styles/theme'
import { AvatarCustomizerDrawer, AvatarCustomizerToggle } from './AvatarCustomizer'
import { CollectionPicker } from './CollectionPicker'
import { ItemsSidebar } from './ItemsSidebar'
import { MobilePreview } from './MobilePreview'
import { PlaybackBar } from './PlaybackBar'
import { PropertiesPanel, type SpringBonesFormProps } from './PropertiesPanel'
import { ReviewBar } from './ReviewBar'
import { ValidationBadge, getValidationStatus } from './ValidationBadge'
import { useEditorLayout } from './useEditorLayout'
import { useItemForm } from './useItemForm'
import * as S from './ItemEditorPage.styles'

const PREVIEW_ID = 'item-editor-preview'
const NOT_FOUND_STATUSES = [401, 403, 404]
const EMPTY_ITEMS: Item[] = []
const SPRING_BONES_PUSH_DELAY_MS = 500

// Panel sizes as react-resizable-panels wants them, percentages of the group. The sidebar sits
// outside the group with a fixed, animated width.
const CENTER_MIN_PCT = 25
const RIGHT_DEFAULT_PCT = 26
const RIGHT_MIN_PCT = 20

const isBodyShape = (value: string): value is BodyShape => BodyShape.validate(value)

/** A navigation held back by unsaved changes: another item, or out of the editor entirely. */
type PendingNavigation = { kind: 'item'; item: Item } | { kind: 'away'; to: string }

// Until the curation feature lands there is no committee check: `?reviewing=true` is ignored.
const isCurator = false

const ItemEditorPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const collectionParam = searchParams.get('collection')
  const collectionId = parseUuidParam(collectionParam) ?? null
  const itemParam = parseUuidParam(searchParams.get('item')) ?? null
  const mode = useMemo(() => getEditorMode(searchParams, isCurator), [searchParams])
  const { session, restored, signIn } = useWallet()
  const address = session?.address
  const showToast = useNotifications(state => state.showToast)
  const isMobile = useMediaQuery(theme.media.maxWidth('mobile'))

  const collectionQuery = useCollection(address, collectionId ?? undefined)
  const itemsQuery = useAllCollectionItems(address, collectionId ?? undefined)
  const baseWearables = useBaseWearables()
  const pickedRenderer = usePreviewRenderer()
  const saveItem = useSaveItem(address)
  const saveCollection = useSaveCollection(address)
  const [isRenameOpen, setRenameOpen] = useState(false)

  const collection = collectionQuery.data
  const items = itemsQuery.data ?? EMPTY_ITEMS
  const selected = useMemo(() => resolveSelectedItem(items, itemParam), [items, itemParam])
  // Unity cannot play a social emote's extra armatures: those items always preview in Babylon.
  const renderer = selected && isSocialEmote(selected) ? PreviewRenderer.BABYLON : pickedRenderer

  // Avatar state (session-only store).
  const bodyShape = useAvatarPreview(state => state.bodyShape)
  const skin = useAvatarPreview(state => state.skin)
  const eyes = useAvatarPreview(state => state.eyes)
  const hair = useAvatarPreview(state => state.hair)
  const baseSelection = useAvatarPreview(state => state.baseWearables)
  const dressedItemIds = useAvatarPreview(state => state.dressedItemIds)
  const emote = useAvatarPreview(state => state.emote)
  const isPlaying = useAvatarPreview(state => state.isPlaying)
  const dress = useAvatarPreview(state => state.dress)
  const toggleDressed = useAvatarPreview(state => state.toggleDressed)
  const clearDressed = useAvatarPreview(state => state.clearDressed)
  const setBodyShape = useAvatarPreview(state => state.setBodyShape)
  const seedBaseWearables = useAvatarPreview(state => state.seedBaseWearables)
  // The store's own mapping, memoized on the fields it reads: subscribing to the selector directly
  // would hand the bridge a new object on every store change and rebuild the preview.
  const avatar = useMemo<AvatarAttributes>(
    () => selectAvatarAttributes({ bodyShape, skin, eyes, hair, baseWearables: baseSelection }),
    [bodyShape, skin, eyes, hair, baseSelection]
  )

  useEffect(() => clearDressed(), [collectionId, clearDressed])
  // The mannequin's outfit is picked the moment the catalog arrives, whether or not the customizer is open.
  useEffect(() => {
    if (baseWearables.data) seedBaseWearables(baseWearables.data)
  }, [baseWearables.data, seedBaseWearables])
  const selectedId = selected?.id ?? null
  // Read inside async work (a save in flight) where the closed-over selection may already be stale.
  const selectedIdRef = useRef(selectedId)
  selectedIdRef.current = selectedId
  const selectedType = selected?.type ?? null
  const selectedCategory = selected?.data.category
  useEffect(() => {
    if (selectedId && selectedType) dress({ id: selectedId, type: selectedType, category: selectedCategory })
  }, [selectedId, selectedType, selectedCategory, dress])

  // Form state.
  const springBones = useSpringBones(selected)
  const form = useItemForm(selected, springBones)
  const [activeSpringHash, setActiveSpringHash] = useState<string | null>(null)
  useBeforeUnloadGuard(form.isDirty)

  const previewSelected = useMemo(() => (selected ? toPreviewItem(selected, form.draft) : null), [selected, form.draft])
  const previewItems = useMemo(() => {
    const withDraft = previewSelected
      ? items.map(item => (item.id === previewSelected.id ? previewSelected : item))
      : items
    return pickDressedItems(withDraft, dressedItemIds, bodyShape)
  }, [items, previewSelected, dressedItemIds, bodyShape])
  const source = useMemo<AvatarPreviewSource>(() => ({ kind: 'items', items: previewItems }), [previewItems])
  const collectionEmotes = useMemo(() => items.filter(item => item.type === ItemType.EMOTE), [items])
  const subjectEmote = useMemo(() => previewItems.find(item => item.type === ItemType.EMOTE) ?? null, [previewItems])
  const previewedWearables = useMemo(() => previewItems.filter(item => item.type === ItemType.WEARABLE), [previewItems])

  const validationSource = useMemo(
    () => (previewSelected ? ({ kind: 'item', item: previewSelected } as const) : null),
    [previewSelected]
  )
  const validationCtx = useMemo(
    () => ({
      type: previewSelected?.type ?? ItemType.WEARABLE,
      category: previewSelected?.data.category,
      hides: previewSelected?.data.hides,
      bodyShape
    }),
    [previewSelected, bodyShape]
  )
  const validation = useModelValidation(validationSource, validationCtx)
  const validationStatus = useMemo(
    () => getValidationStatus(validation.data?.issues, validation.isLoading),
    [validation.data?.issues, validation.isLoading]
  )

  // Preview controller: spring bones are pushed on edits (debounced), on every load and on play.
  const [controller, setController] = useState<IPreviewController | null>(null)
  const [loadCount, setLoadCount] = useState(0)
  const onPreviewLoad = useCallback(() => setLoadCount(count => count + 1), [])
  // Reported for diagnostics only: the iframe shows its own error state.
  const onPreviewError = useCallback((error: Error) => console.error('Avatar preview failed:', error), [])
  const currentSpringHash = useMemo(() => {
    const byShape = springBones.models.find(model => model.bodyShapes.includes(bodyShape))
    return byShape?.hash ?? springBones.models[0]?.hash ?? null
  }, [springBones.models, bodyShape])
  const springParamsForPreview = currentSpringHash ? form.springBoneParams[currentSpringHash] : undefined
  const pushSpringBones = useCallback(() => {
    if (!controller || !selectedId || !springParamsForPreview) return
    controller.physics.setSpringBonesParams(selectedId, springParamsForPreview).catch(() => undefined)
  }, [controller, selectedId, springParamsForPreview])
  const pushSpringBonesRef = useRef(pushSpringBones)
  pushSpringBonesRef.current = pushSpringBones
  useEffect(() => {
    const timer = window.setTimeout(pushSpringBones, SPRING_BONES_PUSH_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [pushSpringBones])
  // A reloaded scene and a restarted emote both come up with no chains, so they get the params
  // again. Through the ref: this fires on the load/play edge only, with whatever is current then.
  useEffect(() => {
    if (loadCount > 0 || isPlaying) pushSpringBonesRef.current()
  }, [loadCount, isPlaying])

  // Selection: the URL is the only source of truth; a dirty draft asks before switching.
  const [pending, setPending] = useState<PendingNavigation | null>(null)
  const navigateToItem = useCallback(
    (item: Item | null) => {
      setSearchParams(prev => {
        const params = new URLSearchParams(prev)
        if (item) params.set('item', item.id)
        else params.delete('item')
        return params
      })
    },
    [setSearchParams]
  )
  const selectItem = useCallback(
    (item: Item) => {
      if (item.id === selectedId) return
      if (form.isDirty) setPending({ kind: 'item', item })
      else navigateToItem(item)
    },
    [selectedId, form.isDirty, navigateToItem]
  )
  const toggleEmotePlay = useCallback(() => {
    if (!controller) return
    void (isPlaying ? controller.emote.pause() : controller.emote.play()).catch(() => undefined)
  }, [controller, isPlaying])

  // Add items: the modal's new item becomes the selection once the list refetches.
  const [addItemsFiles, setAddItemsFiles] = useState<File[] | null>(null)
  const knownIdsRef = useRef<Set<string> | null>(null)
  const [awaitingNewItem, setAwaitingNewItem] = useState(false)
  async function addItems() {
    const files = await pickFiles({ accept: ITEM_EXTENSIONS.join(','), multiple: true })
    if (files.length === 0) return
    // Snapshot the list before the upload so the item the modal creates can be told apart afterwards.
    knownIdsRef.current = new Set(items.map(item => item.id))
    setAddItemsFiles(files)
  }
  const closeAddItems = useCallback(() => {
    setAddItemsFiles(null)
    setAwaitingNewItem(true)
  }, [])
  useEffect(() => {
    if (!awaitingNewItem || !knownIdsRef.current || itemsQuery.isFetching) return
    const known = knownIdsRef.current
    // Several files can be uploaded at once: the last one created is the one to open.
    const added = items
      .filter(item => !known.has(item.id))
      .reduce<Item | null>((latest, item) => (!latest || item.createdAt > latest.createdAt ? item : latest), null)
    // The refetch that follows the upload may not have landed yet; keep waiting for it.
    if (!added) return
    setAwaitingNewItem(false)
    knownIdsRef.current = null
    navigateToItem(added)
  }, [awaitingNewItem, items, itemsQuery.isFetching, navigateToItem])

  // Save / revert.
  const [springWarning, setSpringWarning] = useState(false)
  const isDraftCollection = !!collection && !collection.isPublished && !isCollectionLocked(collection)
  const editable =
    mode === 'edit' && !!collection && !!selected && !!address && canEditItemDetails(collection, selected, address)
  const canDelete =
    editable && isDraftCollection && !!collection && collection.owner.toLowerCase() === address?.toLowerCase()

  async function persist(item: Item) {
    const hasSpringModels = springBones.models.length > 0
    const built = await toSaveableItem(item, form.draft, {
      springBones: hasSpringModels ? (mergeSpringBonesIntoItem(form.springBoneParams) ?? null) : undefined
    })
    const saved = await saveItem.mutateAsync(built)
    queryClient.setQueryData<Item[]>(allCollectionItemsKey(address, collectionId ?? undefined), current =>
      current?.map(candidate => (candidate.id === saved.id ? saved : candidate))
    )
    // The selection may have moved on while the save was in flight; resetting then would wipe the
    // form of whichever item is on screen now with this item's data.
    if (selectedIdRef.current === saved.id) form.reset(saved)
    showToast(t('item_editor.save_success', { name: saved.name }))
  }

  function save() {
    if (!selected) return
    const missing = getShapesMissingSpringBones(form.springBoneParams, springBones.bonesByHash)
    if (missing.length > 0 && !springWarning) {
      setSpringWarning(true)
      return
    }
    setSpringWarning(false)
    persist(selected).catch((error: unknown) => {
      console.error('Item save failed:', error)
      const locked = error instanceof BuilderServerError && error.status === COLLECTION_LOCKED_STATUS
      showToast(t(locked ? 'item_editor.save_error_locked' : 'item_editor.save_error'), { type: 'error' })
    })
  }

  // Read off `form` before the memo: `form` itself is a fresh object every render, so depending on it
  // would defeat the caching and re-render the properties panel on every keystroke.
  const { springBoneParams, setSpringBoneParams } = form
  const springBonesForm = useMemo<SpringBonesFormProps | null>(() => {
    if (!selected || springBones.models.length === 0) return null
    const activeHash =
      activeSpringHash && springBones.models.some(model => model.hash === activeSpringHash)
        ? activeSpringHash
        : (currentSpringHash ?? springBones.models[0].hash)
    return {
      models: springBones.models,
      params: springBoneParams[activeHash] ?? {},
      activeHash,
      onActiveHashChange: hash => {
        setActiveSpringHash(hash)
        // The tab pair doubles as a body-shape switch so the preview shows the edited model.
        const model = springBones.models.find(candidate => candidate.hash === hash)
        const shape = model?.bodyShapes.find(isBodyShape)
        if (shape) setBodyShape(shape)
      },
      onChange: (params: SpringBoneParamsByName) => setSpringBoneParams({ ...springBoneParams, [activeHash]: params })
    }
  }, [selected, springBones, activeSpringHash, currentSpringHash, springBoneParams, setSpringBoneParams, setBodyShape])

  const closeRename = useCallback(() => {
    setRenameOpen(false)
    saveCollection.reset()
  }, [saveCollection])

  // Layout.
  const { sidebarCollapsed, toggleSidebar, panelStorage } = useEditorLayout()
  const [isCustomizerOpen, setCustomizerOpen] = useState(false)
  const closeCustomizer = useCallback(() => setCustomizerOpen(false), [])

  // States.
  const isLoading = !restored || (!!address && !!collectionId && (collectionQuery.isLoading || itemsQuery.isLoading))
  const isNotFound =
    (!!collectionParam && !collectionId) ||
    (!!collectionId &&
      ((collectionQuery.isError &&
        collectionQuery.error instanceof BuilderServerError &&
        NOT_FOUND_STATUSES.includes(collectionQuery.error.status)) ||
        (!!collection && !hasCollectionRole(collection, address))))
  const isError = !isNotFound && !!collectionId && (collectionQuery.isError || itemsQuery.isError)

  const preview =
    renderer === undefined ? null : (
      <AvatarPreview
        // The renderer is baked into the iframe URL at mount, so a switch has to remount the preview.
        key={renderer}
        id={PREVIEW_ID}
        source={source}
        avatar={avatar}
        emote={emote}
        unity={renderer === PreviewRenderer.UNITY}
        onLoad={onPreviewLoad}
        onError={onPreviewError}
        onController={setController}
      >
        <PlaybackBar
          previewId={PREVIEW_ID}
          controller={controller}
          collectionEmotes={collectionEmotes}
          previewedWearables={previewedWearables}
          subjectEmoteId={subjectEmote?.id ?? null}
        />
        <AvatarCustomizerToggle open={isCustomizerOpen} onToggle={() => setCustomizerOpen(open => !open)} />
        {selected && <ValidationBadge status={validationStatus} issues={validation.data?.issues ?? []} />}
      </AvatarPreview>
    )

  if (restored && !session) {
    return (
      <S.Workspace data-testid="item-editor-page">
        <S.StatePanel data-testid="sign-in-panel">
          <PersonOutlineIcon />
          <S.StateTitle>{t('collection_detail_page.sign_in.title')}</S.StateTitle>
          <Button type="button" variant="primary" data-testid="sign-in" onClick={() => signIn()}>
            {t('collection_detail_page.sign_in.action')}
          </Button>
        </S.StatePanel>
      </S.Workspace>
    )
  }

  if (isNotFound) {
    return (
      <S.Workspace data-testid="item-editor-page">
        <S.StatePanel data-testid="collection-not-found">
          <S.StateTitle>{t('collection_detail_page.not_found.title')}</S.StateTitle>
          <S.StateText>{t('collection_detail_page.not_found.description')}</S.StateText>
          <Button type="button" variant="secondary" onClick={() => navigate('/collections')}>
            {t('collection_detail_page.not_found.back')}
          </Button>
        </S.StatePanel>
      </S.Workspace>
    )
  }

  if (isError) {
    return (
      <S.Workspace data-testid="item-editor-page">
        <S.StatePanel data-testid="item-editor-error">
          <S.StateTitle>{t('collection_detail_page.error.title')}</S.StateTitle>
          <S.StateText>{t('collection_detail_page.error.description')}</S.StateText>
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
        </S.StatePanel>
      </S.Workspace>
    )
  }

  if (isLoading || !address) {
    return (
      <S.Workspace data-testid="item-editor-page" aria-busy="true">
        <S.PreviewEmpty data-testid="item-editor-loading">
          <span className="spinner" aria-hidden />
        </S.PreviewEmpty>
      </S.Workspace>
    )
  }

  if (isMobile) {
    return (
      <MobilePreview
        items={items}
        selectedId={selectedId}
        dressedIds={dressedItemIds}
        bodyShape={bodyShape}
        // The strip is the phone's only item control, so a tap does what the sidebar's row and dress
        // button do together: put the item on the avatar and edit it, or take it back off.
        onTap={item => {
          if (!dressedItemIds.includes(item.id)) navigateToItem(item)
          toggleDressed({ id: item.id, type: item.type, category: item.data.category })
        }}
      >
        {collection ? preview : <S.PreviewEmpty>{t('item_editor.pick_collection')}</S.PreviewEmpty>}
        {collection && isCustomizerOpen && (
          <AvatarCustomizerDrawer catalog={baseWearables.data} onClose={closeCustomizer} />
        )}
      </MobilePreview>
    )
  }

  const sidebar = collection ? (
    <ItemsSidebar
      collection={collection}
      items={items}
      isLoading={itemsQuery.isLoading}
      selectedId={selectedId}
      dressedIds={dressedItemIds}
      bodyShape={bodyShape}
      isPlaying={isPlaying}
      mode={mode}
      collapsed={sidebarCollapsed}
      onToggleCollapsed={toggleSidebar}
      canAddItems={isDraftCollection && canManageCollectionItems(collection, address)}
      onRename={
        isDraftCollection && canManageCollectionItems(collection, address) ? () => setRenameOpen(true) : undefined
      }
      onAddItems={() => {
        addItems().catch((error: unknown) => console.error('Add items failed:', error))
      }}
      onSelect={selectItem}
      onLeave={to => {
        if (!form.isDirty) return true
        setPending({ kind: 'away', to })
        return false
      }}
      onToggleDressed={item => toggleDressed({ id: item.id, type: item.type, category: item.data.category })}
      onToggleEmotePlay={toggleEmotePlay}
    />
  ) : (
    <CollectionPicker address={address} onPick={(picked: Collection) => setSearchParams({ collection: picked.id })} />
  )

  return (
    <S.Workspace data-testid="item-editor-page" data-mode={mode}>
      {mode === 'review' && <ReviewBar />}
      <S.Columns>
        {collection ? sidebar : <S.PickerColumn>{sidebar}</S.PickerColumn>}
        <PanelGroup
          direction="horizontal"
          autoSaveId="item-editor"
          storage={panelStorage}
          style={{ flex: 1, minWidth: 0 }}
        >
          <Panel id="editor-center" minSize={CENTER_MIN_PCT} order={2}>
            <S.CenterPanel data-testid="editor-center">
              {collection ? (
                <>
                  <S.PreviewArea>
                    {preview}
                    {/* Babylon only: Unity has no live zoom over the bridge (see ZoomControls). */}
                    {loadCount > 0 && controller && renderer === PreviewRenderer.BABYLON && (
                      <ZoomControls controller={controller} />
                    )}
                  </S.PreviewArea>
                  {isCustomizerOpen && (
                    <AvatarCustomizerDrawer catalog={baseWearables.data} onClose={closeCustomizer} />
                  )}
                </>
              ) : (
                <S.PreviewEmpty data-testid="editor-center-empty">{t('item_editor.pick_collection')}</S.PreviewEmpty>
              )}
            </S.CenterPanel>
          </Panel>
          {collection && selected && (
            <>
              <PanelResizeHandle>
                <S.Handle data-testid="resize-handle-right" />
              </PanelResizeHandle>
              <Panel id="editor-properties" defaultSize={RIGHT_DEFAULT_PCT} minSize={RIGHT_MIN_PCT} order={3}>
                <PropertiesPanel
                  key={selected.id}
                  item={selected}
                  address={address}
                  editable={editable}
                  canDelete={canDelete}
                  draft={form.draft}
                  dispatch={form.dispatch}
                  isDirty={form.isDirty}
                  isSaving={saveItem.isPending}
                  springBones={springBonesForm}
                  onSave={save}
                  onRevert={() => form.reset(selected)}
                  onDeleted={() => navigateToItem(null)}
                />
              </Panel>
            </>
          )}
        </PanelGroup>
      </S.Columns>

      {addItemsFiles && collection && (
        <AddItemsModal collection={collection} address={address} files={addItemsFiles} onClose={closeAddItems} />
      )}
      {isRenameOpen && collection && (
        <CollectionNameModal
          variant="rename"
          initialName={collection.name}
          isPending={saveCollection.isPending}
          error={saveCollection.error?.message ?? null}
          onSubmit={name => {
            if (name === collection.name) {
              closeRename()
              return
            }
            saveCollection.mutate({ ...collection, name }, { onSuccess: closeRename })
          }}
          onClose={closeRename}
        />
      )}
      {pending && (
        <ConfirmModal
          title={t('item_editor.discard.title')}
          description={t('item_editor.discard.description')}
          onClose={() => setPending(null)}
          cancel={{
            label: t('item_editor.discard.stay'),
            onClick: () => setPending(null),
            testId: 'discard-stay'
          }}
          confirm={{
            label: t('item_editor.discard.confirm'),
            onClick: () => {
              const next = pending
              setPending(null)
              if (next.kind === 'item') navigateToItem(next.item)
              else navigate(next.to)
            },
            testId: 'discard-confirm'
          }}
          testId="discard-changes"
        />
      )}
      {springWarning && selected && (
        <ConfirmModal
          title={t('item_editor.spring_bones.warning_title', { name: selected.name })}
          description={t('item_editor.spring_bones.warning_description')}
          onClose={() => setSpringWarning(false)}
          cancel={{
            label: t('item_editor.spring_bones.warning_back'),
            onClick: () => setSpringWarning(false),
            testId: 'spring-warning-back'
          }}
          confirm={{ label: t('item_editor.spring_bones.warning_save'), onClick: save, testId: 'spring-warning-save' }}
          testId="spring-bones-warning"
        />
      )}
    </S.Workspace>
  )
}

export { ItemEditorPage }

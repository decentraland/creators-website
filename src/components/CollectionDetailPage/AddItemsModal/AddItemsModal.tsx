import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '~/components/Button'
import { Modal } from '~/components/Modal'
import { useTranslation } from '~/intl'
import { useAllCollectionItems } from '~/hooks/useCollection'
import { useBeforeUnloadGuard } from '~/hooks/useBeforeUnloadGuard'
import { installBackGuard } from '~/lib/backGuard'
import { ItemFileError, MAX_THUMBNAIL_FILE_SIZE, VIDEO_PATH, toMB } from '~/lib/itemFiles'
import { type ItemDraftPayload } from '~/lib/itemFactory'
import { type Collection } from '~/lib/collections'
import { ItemType } from '~/lib/items'
import { useNotifications } from '~/lib/notifications'
import { executeUpload, planUpload, type UploadDraft } from '~/lib/uploadItems'
import {
  addItemsReducer,
  createDraft,
  createInitialState,
  isDraftComplete,
  isImageWearable,
  type ItemDraft
} from './AddItemsModal.state'
import { imageThumbnailPatch, isImageThumbnailStale, processDraftFile, pickPreviewDraft } from './processDraft'
import { DraftList } from './DraftList'
import { DraftForm } from './DraftForm'
import { DraftProcessor } from './DraftProcessor'
import {
  ThumbnailFormatError,
  ThumbnailModal,
  ThumbnailTooBigError,
  thumbnailPatchFromFile,
  type ThumbnailPatch
} from '~/components/ThumbnailModal'
import { VideoModal } from '~/components/VideoModal'
import { LeaveConfirmModal } from './LeaveConfirmModal'
import { UploadErrorModal } from './UploadErrorModal'
import * as S from './AddItemsModal.styles'

type Props = {
  collection: Collection
  address: string
  /** The files picked or dropped on the collection page; processing starts immediately. */
  files: File[]
  onClose: () => void
}

export function AddItemsModal({ collection, address, files, onClose }: Props) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const showToast = useNotifications(state => state.showToast)

  const initialDraftsRef = useRef<Array<{ draft: ItemDraft; file: File }> | null>(null)
  if (initialDraftsRef.current === null) {
    initialDraftsRef.current = files.map(file => ({ draft: createDraft(file), file }))
  }
  const [state, dispatch] = useReducer(
    addItemsReducer,
    initialDraftsRef.current.map(entry => entry.draft),
    createInitialState
  )

  const [isLeaveConfirmOpen, setLeaveConfirmOpen] = useState(false)
  const [isThumbnailOpen, setThumbnailOpen] = useState(false)
  const [isVideoOpen, setVideoOpen] = useState(false)
  const thumbnailInputRef = useRef<HTMLInputElement>(null)

  // Variant targets need every unpublished wearable of the collection, not just the loaded page.
  const collectionItemsQuery = useAllCollectionItems(address, collection.id)
  const collectionItems = useMemo(() => collectionItemsQuery.data ?? [], [collectionItemsQuery.data])

  // Load + analyze each dropped file once.
  useEffect(() => {
    for (const { draft, file } of initialDraftsRef.current ?? []) {
      void processDraftFile(file)
        .then(patch => dispatch({ type: 'draftAnalyzed', id: draft.id, patch }))
        .catch((error: unknown) => {
          if (error instanceof ItemFileError) {
            dispatch({
              type: 'draftFailed',
              id: draft.id,
              errorKey: error.messageKey,
              errorParams: error.messageParams
            })
          } else {
            console.error('Draft processing failed:', error)
            dispatch({ type: 'draftFailed', id: draft.id, errorKey: 'invalid_model_file' })
          }
        })
    }
  }, [])

  const { drafts, selectedId, view, failureReason, isUploading } = state
  const selected = useMemo(
    () => drafts.find(draft => draft.id === selectedId) ?? drafts[0] ?? null,
    [drafts, selectedId]
  )
  const processingIdRef = useRef<string | null>(null)
  const previewDraft = useMemo(
    () => pickPreviewDraft(drafts, selected?.id ?? null, processingIdRef.current),
    [drafts, selected?.id]
  )
  useEffect(() => {
    processingIdRef.current = previewDraft?.id ?? null
  }, [previewDraft?.id])

  // Image wearables are padded per category, so a category change re-pads our auto thumbnail.
  const repaddingIdsRef = useRef(new Set<string>())
  useEffect(() => {
    const stale = drafts.find(draft => isImageThumbnailStale(draft) && !repaddingIdsRef.current.has(draft.id))
    if (!stale) return
    repaddingIdsRef.current.add(stale.id)
    void imageThumbnailPatch(stale.contents, stale.model, stale.category)
      .then(patch =>
        dispatch({ type: 'draftAnalyzed', id: stale.id, patch: { ...patch, autoThumbnailCategory: stale.category } })
      )
      .catch((error: unknown) => console.error('Thumbnail re-padding failed:', error))
      .finally(() => repaddingIdsRef.current.delete(stale.id))
  }, [drafts])

  const isSelectedComplete = useMemo(
    () => !!selected && isDraftComplete(selected, drafts, collectionItems),
    [selected, drafts, collectionItems]
  )
  const othersChecked = useMemo(
    () => !!selected && drafts.every(draft => draft.id === selected.id || draft.checked),
    [selected, drafts]
  )
  const selectedIndex = useMemo(
    () => (selected ? drafts.findIndex(draft => draft.id === selected.id) : -1),
    [selected, drafts]
  )
  const hasCheckedDrafts = useMemo(() => drafts.some(draft => draft.checked), [drafts])

  // Everything deleted → nothing left to review, close silently.
  useEffect(() => {
    if (drafts.length === 0 && !isUploading) onClose()
  }, [drafts.length, isUploading, onClose])

  useBeforeUnloadGuard(drafts.length > 0)

  // Browser back would silently unmount the modal; the back guard absorbs it and shows the same
  // leave confirmation instead.
  useEffect(() => installBackGuard(() => setLeaveConfirmOpen(true)), [])

  function toPayload(draft: ItemDraft): UploadDraft {
    return {
      id: draft.id,
      name: draft.name.trim(),
      type: draft.type ?? ItemType.WEARABLE,
      bodyShape: draft.bodyShape,
      category: draft.category ?? '',
      rarity: draft.rarity,
      playMode: draft.playMode,
      requiredPermissions: draft.isSmart ? draft.requiredPermissions : undefined,
      description: draft.description,
      tags: draft.tags,
      blockVrmExport: draft.blockVrmExport,
      contents: draft.contents,
      model: draft.model,
      metrics: draft.metrics ?? {},
      owner: address,
      collectionId: collection.id,
      variantTargetId: draft.isVariant && draft.variantTargetId ? draft.variantTargetId : undefined
    } satisfies ItemDraftPayload & { variantTargetId?: string }
  }

  async function upload(draftsToUpload: ItemDraft[]) {
    dispatch({ type: 'uploadStarted' })
    const allIds = draftsToUpload.map(draft => draft.id)
    try {
      const operations = await planUpload(draftsToUpload.map(toPayload), collectionItems)
      const result = await executeUpload(address, operations)

      if (result.savedDraftIds.length > 0) {
        showToast(t('add_items_modal.success_toast', { count: result.savedDraftIds.length }))
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['collection-items-all', address, collection.id] }),
          queryClient.invalidateQueries({ queryKey: ['collection', address, collection.id] }),
          queryClient.invalidateQueries({ queryKey: ['collection-preview', address, collection.id] }),
          queryClient.invalidateQueries({ queryKey: ['collections'] })
        ])
      }

      if (result.failedDraftIds.length > 0) {
        dispatch({
          type: 'uploadFailed',
          failureReason: result.failureReason ?? 'generic',
          failedDraftIds: result.failedDraftIds
        })
      } else {
        onClose()
      }
    } catch {
      dispatch({ type: 'uploadFailed', failureReason: 'generic', failedDraftIds: allIds })
    }
  }

  function handleFinish() {
    if (!selected) return
    // FINISH also confirms the item being viewed; every other draft is already checked, so the
    // selection stays put and the list shows the last green check before the upload starts.
    dispatch({ type: 'draftChecked', id: selected.id })
    const finalDrafts = drafts.map(draft => (draft.id === selected.id ? { ...draft, checked: true } : draft))
    void upload(finalDrafts)
  }

  function handleThumbnailUpload(file: File | undefined) {
    if (!file || !selected) return
    const id = selected.id
    void thumbnailPatchFromFile(selected.contents, file)
      .then(patch => dispatch({ type: 'draftUpdated', id, patch }))
      .catch((err: unknown) => {
        showToast(
          t(
            err instanceof ThumbnailFormatError
              ? 'thumbnail_modal.wrong_format'
              : err instanceof ThumbnailTooBigError
                ? 'thumbnail_modal.too_big'
                : 'thumbnail_modal.capture_failed',
            { size: toMB(MAX_THUMBNAIL_FILE_SIZE) }
          ),
          { type: 'error' }
        )
      })
  }

  function handleVideoChange(video: File) {
    if (!selected) return
    dispatch({
      type: 'draftUpdated',
      id: selected.id,
      patch: { contents: { ...selected.contents, [VIDEO_PATH]: video } }
    })
  }

  function handleSaveChanges() {
    const checked = drafts.filter(draft => draft.checked)
    // A checked variant whose base draft is still unreviewed can't be saved on its own: point the
    // creator at that base draft instead of silently dropping the variant.
    const checkedIds = new Set(checked.map(draft => draft.id))
    // Variants of existing collection items are fine on their own.
    const orphan = checked.find(
      draft =>
        draft.isVariant &&
        !checkedIds.has(draft.variantTargetId ?? '') &&
        drafts.some(candidate => candidate.id === draft.variantTargetId)
    )
    const orphanTarget = orphan && drafts.find(draft => draft.id === orphan.variantTargetId)
    setLeaveConfirmOpen(false)
    if (orphan && orphanTarget) {
      dispatch({ type: 'draftSelected', id: orphanTarget.id })
      showToast(t('add_items_modal.leave.review_target_first', { target: orphanTarget.name, variant: orphan.name }), {
        type: 'error'
      })
      return
    }
    void upload(checked)
  }

  function requestClose() {
    if (isUploading || isLeaveConfirmOpen || isThumbnailOpen || isVideoOpen) return
    // Nothing salvageable to lose: every file failed to import.
    if (drafts.every(draft => draft.status === 'failed')) {
      onClose()
      return
    }
    setLeaveConfirmOpen(true)
  }

  if (view === 'error') {
    return (
      <UploadErrorModal
        reason={failureReason ?? 'generic'}
        onCancel={onClose}
        onRetry={() => dispatch({ type: 'retryRequested' })}
      />
    )
  }

  const isSingle = drafts.length === 1
  const showFinish = isSingle || othersChecked

  return (
    <>
      <Modal
        title={t('add_items_modal.title', { count: drafts.length })}
        onClose={requestClose}
        size="wide"
        flush={!isSingle}
        closeDisabled={isUploading}
        testId="add-items-modal"
      >
        {/* `inert` isn't in React 18's typings, so it goes through the spread. */}
        <S.Layout
          data-flush={!isSingle || undefined}
          data-uploading={isUploading || undefined}
          aria-busy={isUploading || undefined}
          {...(isUploading ? { inert: '' } : {})}
        >
          {/* A single upload gets the sidebar-less layout from the design. */}
          {!isSingle && (
            <DraftList
              drafts={drafts}
              selectedId={selected?.id ?? null}
              onSelect={id => dispatch({ type: 'draftSelected', id })}
              onRemove={id => dispatch({ type: 'draftRemoved', id })}
            />
          )}
          <S.Main>
            {selected && selected.status === 'ready' ? (
              <DraftForm
                draft={selected}
                drafts={drafts}
                collectionItems={collectionItems}
                onUpdate={(id, patch) => dispatch({ type: 'draftUpdated', id, patch })}
                onOpenThumbnail={() =>
                  isImageWearable(selected) ? thumbnailInputRef.current?.click() : setThumbnailOpen(true)
                }
                onOpenVideo={() => setVideoOpen(true)}
                onVideoChange={handleVideoChange}
              />
            ) : (
              <S.ProcessingPane data-testid="draft-processing">
                {selected?.status === 'failed' ? (
                  t(`add_items_modal.file_error.${selected.errorKey ?? 'invalid_model_file'}`, selected.errorParams)
                ) : (
                  <>
                    <S.ProcessingSpinner data-testid="draft-processing-spinner" aria-hidden />
                    {t('add_items_modal.processing')}
                  </>
                )}
              </S.ProcessingPane>
            )}
            <S.Footer>
              <Button
                type="button"
                variant="secondary"
                data-testid="add-items-cancel"
                disabled={isUploading}
                onClick={requestClose}
              >
                {t('add_items_modal.cancel')}
              </Button>
              <S.FooterRight>
                {!isSingle && (
                  <Button
                    type="button"
                    variant="secondary"
                    data-testid="add-items-previous"
                    disabled={isUploading || selectedIndex <= 0}
                    onClick={() => {
                      const previous = drafts[selectedIndex - 1]
                      if (previous) dispatch({ type: 'draftSelected', id: previous.id })
                    }}
                  >
                    {t('add_items_modal.previous')}
                  </Button>
                )}
                {showFinish ? (
                  <Button
                    type="button"
                    variant="primary"
                    data-testid="add-items-finish"
                    disabled={!isSelectedComplete}
                    loading={isUploading}
                    onClick={handleFinish}
                  >
                    {isSingle ? t('add_items_modal.save') : t('add_items_modal.finish')}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="primary"
                    data-testid="add-items-save-next"
                    disabled={!isSelectedComplete || isUploading}
                    onClick={() => selected && dispatch({ type: 'draftChecked', id: selected.id })}
                  >
                    {t('add_items_modal.save_next')}
                  </Button>
                )}
              </S.FooterRight>
            </S.Footer>
          </S.Main>
        </S.Layout>
      </Modal>

      {previewDraft && (
        <DraftProcessor
          draft={previewDraft}
          onResult={(id, patch) => dispatch({ type: 'draftAnalyzed', id, patch })}
          onError={id => dispatch({ type: 'draftFailed', id, errorKey: 'invalid_model_file' })}
        />
      )}

      <input
        ref={thumbnailInputRef}
        type="file"
        accept="image/png"
        hidden
        data-testid="thumbnail-file-input"
        onChange={event => {
          handleThumbnailUpload(event.target.files?.[0])
          event.target.value = ''
        }}
      />

      {isThumbnailOpen && selected && selected.status === 'ready' && (
        <ThumbnailModal
          type={selected.type}
          contents={selected.contents}
          onClose={() => setThumbnailOpen(false)}
          onSave={(patch: ThumbnailPatch) => {
            dispatch({ type: 'draftUpdated', id: selected.id, patch })
            setThumbnailOpen(false)
          }}
        />
      )}

      {isVideoOpen && selected && selected.status === 'ready' && (
        <VideoModal
          video={selected.contents[VIDEO_PATH] ?? null}
          onChange={handleVideoChange}
          onClose={() => setVideoOpen(false)}
        />
      )}

      {isLeaveConfirmOpen && (
        <LeaveConfirmModal
          hasCheckedDrafts={hasCheckedDrafts}
          isSaving={isUploading}
          onLeave={onClose}
          onSaveChanges={handleSaveChanges}
          onStay={() => setLeaveConfirmOpen(false)}
        />
      )}
    </>
  )
}

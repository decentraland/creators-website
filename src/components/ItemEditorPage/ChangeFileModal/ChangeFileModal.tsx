import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react'
import {
  ErrorOutline as HintIcon,
  Female as FemaleIcon,
  Male as MaleIcon,
  Transgender as BothIcon,
  UploadFileOutlined as UploadIcon
} from '@mui/icons-material'
import { Button } from '~/components/Button'
import { CategorySelect } from '~/components/CategorySelect'
import { Checkbox } from '~/components/Checkbox'
import {
  DraftPreviewPane,
  DraftProcessor,
  createDraft,
  imageThumbnailPatch,
  needsPreviewData,
  type ItemDraft
} from '~/components/CollectionDetailPage/AddItemsModal'
import { ConfirmModal } from '~/components/ConfirmModal'
import { Modal } from '~/components/Modal'
import { Tooltip } from '~/components/Tooltip'
import { useThumbnailEditor } from '~/hooks/useThumbnailEditor'
import { useTranslation } from '~/intl'
import { errorCode, track } from '~/lib/analytics'
import { pickFile } from '~/lib/filePicker'
import { type BuiltItem } from '~/lib/itemFactory'
import { ITEM_EXTENSIONS, ItemFileError, THUMBNAIL_PATH, getExtension, isImageFile } from '~/lib/itemFiles'
import {
  buildModelUpdate,
  getDefaultBodyShape,
  getModelUpdateError,
  getModelUpdateMode,
  getPreviewModel,
  isBodyShapeLocked,
  loadModelForItem,
  needsNewCategory,
  type LoadedItemModel
} from '~/lib/itemModelImport'
import { BodyShapeType, ItemType, isSmartWearable, type Item } from '~/lib/items'
import { captureError } from '~/lib/monitoring'
import { getWearableCategoryOptions } from '~/lib/wearableCategories'
import * as S from './ChangeFileModal.styles'

export type ChangeFileResult = {
  update: BuiltItem
  /** The new render, when the creator kept it as the item's thumbnail. */
  thumbnail: Blob | null
  /** Picked here only when the new file can't keep the item's category. */
  category: string | null
}

type Props = {
  item: Item
  /** "Add {shape} representation": the pick is fixed to the shape the item lacks. */
  lockedBodyShape?: BodyShapeType.MALE | BodyShapeType.FEMALE
  onApply: (result: ChangeFileResult) => void
  onClose: () => void
}

const BODY_SHAPES: Array<{ value: BodyShapeType; icon: ReactNode }> = [
  { value: BodyShapeType.BOTH, icon: <BothIcon /> },
  { value: BodyShapeType.FEMALE, icon: <FemaleIcon /> },
  { value: BodyShapeType.MALE, icon: <MaleIcon /> }
]

/**
 * Loads a new model for a saved item and lets the creator pick which body shape it goes to; the result
 * lands in the editor draft, the editor's Save uploads it.
 */
export function ChangeFileModal({ item, lockedBodyShape, onApply, onClose }: Props) {
  const { t, rich } = useTranslation()
  const [file, setFile] = useState<File | null>(null)
  const [loaded, setLoaded] = useState<LoadedItemModel | null>(null)
  const [draft, setDraft] = useState<ItemDraft | null>(null)
  const [isLoading, setLoading] = useState(false)
  const [isDragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bodyShape, setBodyShape] = useState<BodyShapeType>(lockedBodyShape ?? BodyShapeType.BOTH)
  const [keepThumbnail, setKeepThumbnail] = useState(true)
  const [category, setCategory] = useState<string | null>(null)
  const [isApplying, setApplying] = useState(false)
  const [isDiscardOpen, setDiscardOpen] = useState(false)
  // A file picked after the modal closed must not land in state.
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const thumbnailEditor = useThumbnailEditor(patch => {
    setDraft(
      current => current && { ...current, thumbnail: patch.thumbnail, contents: patch.contents, isAutoThumbnail: false }
    )
  })

  const locked = lockedBodyShape !== undefined || isBodyShapeLocked(item, loaded)
  const lockHint =
    item.type === ItemType.EMOTE
      ? t('add_items_modal.body_shape_emote_hint')
      : isSmartWearable(item) || loaded?.isSmart
        ? t('add_items_modal.body_shape_smart_hint')
        : null
  const mode = useMemo(() => getModelUpdateMode(item, bodyShape), [item, bodyShape])
  const pickError = useMemo(
    () => (loaded ? getModelUpdateError(loaded, item, bodyShape) : null),
    [loaded, item, bodyShape]
  )
  const needsCategory = useMemo(() => !!loaded && needsNewCategory(loaded, item, bodyShape), [loaded, item, bodyShape])
  const categories = useMemo(() => (loaded ? getWearableCategoryOptions(loaded.contents) : []), [loaded])
  const shapeLabel = t(`add_items_modal.body_shape_option.${bodyShape}`)
  const isReady = !!draft && !!draft.metrics && !!draft.thumbnail
  const canApply = isReady && !pickError && (!needsCategory || category !== null) && !isApplying

  function reportError(err: unknown) {
    const key = err instanceof ItemFileError ? err.messageKey : 'invalid_model_file'
    const params = err instanceof ItemFileError ? err.messageParams : undefined
    if (!(err instanceof ItemFileError)) captureError(err, { flow: 'item_file_change' })
    track('Change item file error', { itemId: item.id, error: err instanceof ItemFileError ? key : errorCode(err) })
    setError(t(`add_items_modal.file_error.${key}`, params))
  }

  async function handleFile(picked: File | null | undefined) {
    if (!picked) return
    setDragging(false)
    setError(null)
    setLoading(true)
    try {
      const next = await loadModelForItem(picked, item)
      if (!mountedRef.current) return
      const base = createDraft(picked, { nameFromFile: false })
      const shape = lockedBodyShape ?? getDefaultBodyShape(item, next)
      let patch: Partial<ItemDraft> = {
        status: 'ready',
        type: next.type,
        // The preview measures and renders what the pick will use: one folder of a two-folder zip.
        ...getPreviewModel(next, shape),
        bodyShape: shape,
        bodyShapeLocked: isBodyShapeLocked(item, next),
        isSmart: next.isSmart,
        requiredPermissions: next.requiredPermissions,
        category: item.data.category ?? null,
        rarity: item.rarity ?? base.rarity,
        hides: item.data.hides ?? [],
        metrics: next.metrics,
        validationIssues: next.validationIssues,
        validatedCategory: item.data.category ?? null
      }
      if (isImageFile(next.model)) {
        patch = { ...patch, ...(await imageThumbnailPatch(next.contents, next.model, item.data.category ?? null)) }
        patch.isAutoThumbnail = true
        patch.autoThumbnailCategory = item.data.category ?? null
      }
      if (!mountedRef.current) return
      setFile(picked)
      setLoaded(next)
      setDraft({ ...base, ...patch })
      setBodyShape(shape)
      setCategory(null)
    } catch (err) {
      if (mountedRef.current) reportError(err)
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }

  function pickShape(value: BodyShapeType) {
    if (locked || !loaded || value === bodyShape) return
    setBodyShape(value)
    const preview = getPreviewModel(loaded, value)
    // A different folder is a different model: its metrics and render come from the preview again.
    setDraft(current => {
      if (!current || current.model === preview.model) return current
      return { ...current, ...preview, metrics: null, thumbnail: null, isAutoThumbnail: false }
    })
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault()
    handleFile(event.dataTransfer.files[0]).catch(() => undefined)
  }

  async function browse() {
    await handleFile(await pickFile({ accept: ITEM_EXTENSIONS.join(',') }))
  }

  async function apply() {
    if (!loaded || !draft || !canApply) return
    setApplying(true)
    try {
      const update = await buildModelUpdate(loaded, item, bodyShape, draft.metrics ?? loaded.metrics ?? {})
      const thumbnail = keepThumbnail ? (draft.contents[THUMBNAIL_PATH] ?? null) : null
      track('Change item file', {
        itemId: item.id,
        bodyShape,
        mode,
        fileKind: (file && getExtension(file.name)?.slice(1)) ?? 'unknown',
        thumbnailRegenerated: thumbnail !== null
      })
      onApply({ update, thumbnail, category: needsCategory ? category : null })
    } catch (err) {
      reportError(err)
    } finally {
      if (mountedRef.current) setApplying(false)
    }
  }

  function requestClose() {
    if (isApplying || thumbnailEditor.isOpen) return
    if (draft) setDiscardOpen(true)
    else onClose()
  }

  const title = lockedBodyShape
    ? t('item_editor.details.add_representation', { shape: t(`add_items_modal.body_shape_option.${lockedBodyShape}`) })
    : t('item_editor.details.change_file')

  return (
    <>
      <Modal title={title} onClose={requestClose} size="wide" closeDisabled={isApplying} testId="change-file-modal">
        <S.Layout>
          <S.Main>
            {isLoading ? (
              <S.ProcessingPane data-testid="change-file-processing">
                <S.ProcessingSpinner aria-hidden />
                {t('add_items_modal.processing')}
              </S.ProcessingPane>
            ) : draft && loaded ? (
              <S.Content data-testid="change-file-form">
                <DraftPreviewPane
                  draft={draft}
                  onOpenThumbnail={() =>
                    thumbnailEditor.edit({ kind: 'files', id: draft.id, type: draft.type, contents: draft.contents })
                  }
                >
                  <S.ThumbnailToggle>
                    <Checkbox checked={keepThumbnail} onChange={setKeepThumbnail} testId="change-file-keep-thumbnail">
                      {t('item_editor.change_file.use_thumbnail')}
                    </Checkbox>
                  </S.ThumbnailToggle>
                </DraftPreviewPane>
                <S.FormPane>
                  <S.FormHeading>{t('item_editor.change_file.heading')}</S.FormHeading>
                  <S.Field as="div" data-hinted>
                    <S.FieldLabel>
                      {t('add_items_modal.body_shape')}
                      <S.FieldHint data-testid="change-file-effect">
                        <HintIcon />
                        {lockHint ?? t(`item_editor.change_file.effect.${mode}`, { shape: shapeLabel })}
                      </S.FieldHint>
                    </S.FieldLabel>
                    <S.Segmented role="radiogroup" aria-label={t('add_items_modal.body_shape')}>
                      {BODY_SHAPES.map(({ value, icon }) => {
                        const selected = bodyShape === value
                        return (
                          <Tooltip
                            key={value}
                            content={
                              locked && !selected ? (lockHint ?? t('item_editor.change_file.locked_hint')) : null
                            }
                            asChild
                            testId={`body-shape-${value}-tooltip`}
                          >
                            <S.SegmentButton
                              type="button"
                              role="radio"
                              aria-disabled={locked || undefined}
                              aria-checked={selected}
                              data-selected={selected || undefined}
                              data-testid={`body-shape-${value}`}
                              onClick={() => pickShape(value)}
                            >
                              {icon}
                              {t(`add_items_modal.body_shape_option.${value}`)}
                            </S.SegmentButton>
                          </Tooltip>
                        )
                      })}
                    </S.Segmented>
                    {pickError && (
                      <S.ErrorText data-testid="change-file-pick-error">
                        {t(`add_items_modal.file_error.${pickError}`)}
                      </S.ErrorText>
                    )}
                  </S.Field>
                  {needsCategory && (
                    <S.Field as="div">
                      <S.FieldLabel>
                        {t('add_items_modal.category')}
                        <S.FieldHint>
                          <HintIcon />
                          {t('item_editor.change_file.category_hint')}
                        </S.FieldHint>
                      </S.FieldLabel>
                      <CategorySelect
                        value={category}
                        categories={categories}
                        testId="change-file-category"
                        onChange={setCategory}
                      />
                    </S.Field>
                  )}
                  {error && <S.ErrorText data-testid="change-file-error">{error}</S.ErrorText>}
                </S.FormPane>
              </S.Content>
            ) : (
              <S.Dropzone
                data-testid="change-file-dropzone"
                data-dragging={isDragging || undefined}
                onDragOver={event => {
                  event.preventDefault()
                  setDragging(true)
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
              >
                <S.DropIcon>
                  <UploadIcon />
                </S.DropIcon>
                <S.DropTitle>{t('item_editor.change_file.drop_title')}</S.DropTitle>
                <S.DropText>
                  {rich('item_editor.change_file.drop_description', {
                    browse: chunks => (
                      <S.BrowseLink type="button" data-testid="change-file-browse" onClick={() => void browse()}>
                        {chunks}
                      </S.BrowseLink>
                    )
                  })}
                </S.DropText>
                <S.DropFormats>{t('collection_detail_page.empty.formats')}</S.DropFormats>
                {error && <S.DropError data-testid="change-file-error">{error}</S.DropError>}
              </S.Dropzone>
            )}
            <S.Footer>
              <Button
                type="button"
                variant="secondary"
                data-testid="change-file-cancel"
                disabled={isApplying}
                onClick={requestClose}
              >
                {t('add_items_modal.cancel')}
              </Button>
              <S.FooterRight>
                <Button
                  type="button"
                  variant="primary"
                  data-testid="change-file-apply"
                  disabled={!canApply}
                  loading={isApplying}
                  onClick={() => void apply()}
                >
                  {t('item_editor.change_file.apply')}
                </Button>
              </S.FooterRight>
            </S.Footer>
          </S.Main>
        </S.Layout>
      </Modal>

      {draft && needsPreviewData(draft) && (
        <DraftProcessor
          draft={draft}
          onResult={(id, patch) =>
            setDraft(current => (current && current.id === id ? { ...current, ...patch } : current))
          }
          onError={() => {
            setDraft(null)
            setLoaded(null)
            setError(t('add_items_modal.file_error.invalid_model_file'))
          }}
        />
      )}

      {thumbnailEditor.modal}

      {isDiscardOpen && (
        <ConfirmModal
          title={t('item_editor.change_file.discard_title')}
          description={t('item_editor.change_file.discard_description')}
          onClose={() => setDiscardOpen(false)}
          cancel={{ label: t('item_editor.change_file.discard'), onClick: onClose, testId: 'change-file-discard' }}
          confirm={{
            label: t('add_items_modal.leave.keep_editing'),
            onClick: () => setDiscardOpen(false),
            testId: 'change-file-keep-editing'
          }}
          testId="change-file-discard-modal"
        />
      )}
    </>
  )
}

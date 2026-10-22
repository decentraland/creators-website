import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { ErrorOutline as HintIcon, UploadFileOutlined as UploadIcon } from '@mui/icons-material'
import { Button } from '~/components/Button'
import { CategorySelect } from '~/components/CategorySelect'
import { Checkbox } from '~/components/Checkbox'
import {
  BODY_SHAPE_OPTIONS,
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
import {
  ITEM_EXTENSIONS,
  ItemFileError,
  THUMBNAIL_PATH,
  getBodyShapeTypeFromContents,
  getExtension,
  isImageFile
} from '~/lib/itemFiles'
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
import { BodyShapeType, IMAGE_WEARABLE_METRICS, ItemType, isSmartWearable, type Item } from '~/lib/items'
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
  /** Persists the change; the modal closes when it resolves and stays open when it rejects. */
  onSave: (result: ChangeFileResult) => Promise<void>
  onClose: () => void
}

/**
 * What the preview measures and renders for a pick: one folder of a two-folder zip. A texture needs no
 * preview run, so its fixed metrics and padded thumbnail are filled here; a 3D model leaves them to the
 * DraftProcessor, under an id of its own so a run still going for another folder can't land on it.
 */
async function previewPatch(
  baseId: string,
  loaded: LoadedItemModel,
  shape: BodyShapeType,
  category: string | null
): Promise<Partial<ItemDraft>> {
  const preview = getPreviewModel(loaded, shape)
  const patch: Partial<ItemDraft> = {
    id: `${baseId}:${shape}`,
    ...preview,
    metrics: loaded.metrics,
    thumbnail: null,
    isAutoThumbnail: false,
    autoThumbnailCategory: null
  }
  if (!isImageFile(preview.model)) return patch
  return {
    ...patch,
    ...(await imageThumbnailPatch(preview.contents, preview.model, category)),
    metrics: IMAGE_WEARABLE_METRICS,
    isAutoThumbnail: true,
    autoThumbnailCategory: category
  }
}

/**
 * Loads a new model for a saved item and lets the creator pick which body shape it goes to; Save
 * persists the item at once, as the legacy builder's modal did.
 */
export function ChangeFileModal({ item, lockedBodyShape, onSave, onClose }: Props) {
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
  const [isSaving, setSaving] = useState(false)
  const [isDiscardOpen, setDiscardOpen] = useState(false)
  // A file picked after the modal closed must not land in state; a preview patch for a pick that was
  // changed again while it was being prepared must not either.
  const mountedRef = useRef(true)
  const pickRef = useRef(0)
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
  const canSave = isReady && !pickError && (!needsCategory || category !== null) && !isSaving

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
      const category = item.data.category ?? null
      const patch: Partial<ItemDraft> = {
        status: 'ready',
        type: next.type,
        bodyShape: shape,
        bodyShapeLocked: isBodyShapeLocked(item, next),
        isSmart: next.isSmart,
        requiredPermissions: next.requiredPermissions,
        category,
        rarity: item.rarity ?? base.rarity,
        hides: item.data.hides ?? [],
        validationIssues: next.validationIssues,
        validatedCategory: category,
        ...(await previewPatch(base.id, next, shape, category))
      }
      if (!mountedRef.current) return
      pickRef.current++
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
    if (locked || !loaded || !draft || value === bodyShape) return
    setBodyShape(value)
    // Another folder of a two-folder zip is another model: its metrics and render come from the preview again.
    if (getBodyShapeTypeFromContents(loaded.contents) !== BodyShapeType.BOTH) return
    const pick = ++pickRef.current
    const baseId = draft.id.split(':')[0]
    previewPatch(baseId, loaded, value, item.data.category ?? null)
      .then(patch => {
        if (!mountedRef.current || pickRef.current !== pick) return
        setDraft(current => current && { ...current, ...patch })
      })
      .catch((err: unknown) => {
        if (mountedRef.current && pickRef.current === pick) reportError(err)
      })
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault()
    handleFile(event.dataTransfer.files[0]).catch(() => undefined)
  }

  async function browse() {
    await handleFile(await pickFile({ accept: ITEM_EXTENSIONS.join(',') }))
  }

  async function save() {
    if (!loaded || !draft || !canSave) return
    setSaving(true)
    try {
      const update = await buildModelUpdate(loaded, item, bodyShape, draft.metrics ?? loaded.metrics ?? {})
      const thumbnail = keepThumbnail ? (draft.contents[THUMBNAIL_PATH] ?? null) : null
      await onSave({ update, thumbnail, category: needsCategory ? category : null })
      track('Change item file', {
        itemId: item.id,
        bodyShape,
        mode,
        fileKind: (file && getExtension(file.name)?.slice(1)) ?? 'unknown',
        thumbnailRegenerated: thumbnail !== null
      })
      onClose()
    } catch (err) {
      // A failed save already toasted: the modal stays open for another try.
      if (err instanceof ItemFileError || !(err instanceof Error)) reportError(err)
    } finally {
      if (mountedRef.current) setSaving(false)
    }
  }

  function requestClose() {
    if (isSaving || thumbnailEditor.isOpen) return
    if (draft) setDiscardOpen(true)
    else onClose()
  }

  const title = lockedBodyShape
    ? t('item_editor.details.add_representation', { shape: t(`add_items_modal.body_shape_option.${lockedBodyShape}`) })
    : t('item_editor.details.change_file')

  return (
    <>
      <Modal title={title} onClose={requestClose} size="wide" closeDisabled={isSaving} testId="change-file-modal">
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
                      {BODY_SHAPE_OPTIONS.map(({ value, icon }) => {
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
                disabled={isSaving}
                onClick={requestClose}
              >
                {t('add_items_modal.cancel')}
              </Button>
              <S.FooterRight>
                <Button
                  type="button"
                  variant="primary"
                  data-testid="change-file-save"
                  disabled={!canSave}
                  loading={isSaving}
                  onClick={() => void save()}
                >
                  {t('add_items_modal.save')}
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

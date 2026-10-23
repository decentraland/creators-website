import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { ErrorOutline as HintIcon, UploadFileOutlined as UploadIcon } from '@mui/icons-material'
import { Button } from '~/components/Button'
import { CategorySelect } from '~/components/CategorySelect'
import { Checkbox } from '~/components/Checkbox'
import { ConfirmModal } from '~/components/ConfirmModal'
import { BodyShapePicker, DraftPreviewPane, DraftProcessor } from '~/components/ItemDraftModal'
import { Modal } from '~/components/Modal'
import { useThumbnailEditor } from '~/hooks/useThumbnailEditor'
import { useTranslation } from '~/intl'
import { errorCode, track } from '~/lib/analytics'
import { imageThumbnailPatch, needsPreviewData, type PreviewDraft } from '~/lib/draftPreview'
import { pickFile } from '~/lib/filePicker'
import { type ItemFileChange } from '~/lib/itemDraft'
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
import { DEFAULT_RARITY } from '~/lib/rarities'
import { getWearableCategoryOptions } from '~/lib/wearableCategories'
import * as S from './ChangeFileModal.styles'

type Props = {
  item: Item
  /** "Add {shape} representation": the pick is fixed to the shape the item lacks. */
  lockedBodyShape?: BodyShapeType.MALE | BodyShapeType.FEMALE
  /** Persists the change; the modal closes when it resolves and stays open when it rejects (already reported). */
  onSave: (change: ItemFileChange) => Promise<void>
  onClose: () => void
}

/**
 * What the preview measures and renders for a pick: one folder of a two-folder zip, under an id of its
 * own so a run still going for another folder can't land on it. A 3D model leaves metrics and the render
 * to the DraftProcessor; a texture takes its fixed metrics here and its padded thumbnail from `textureThumbnail`.
 */
function previewFor(baseId: string, loaded: LoadedItemModel, shape: BodyShapeType): Partial<PreviewDraft> {
  const preview = getPreviewModel(loaded, shape)
  return {
    id: `${baseId}:${shape}`,
    ...preview,
    metrics: isImageFile(preview.model) ? IMAGE_WEARABLE_METRICS : loaded.metrics,
    thumbnail: null,
    isAutoThumbnail: false,
    autoThumbnailCategory: null
  }
}

async function textureThumbnail(
  preview: Partial<PreviewDraft>,
  category: string | null
): Promise<Partial<PreviewDraft>> {
  if (!preview.model || !preview.contents || !isImageFile(preview.model)) return {}
  return {
    ...(await imageThumbnailPatch(preview.contents, preview.model, category)),
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
  const [draft, setDraft] = useState<PreviewDraft | null>(null)
  const [isLoading, setLoading] = useState(false)
  const [isDragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bodyShape, setBodyShape] = useState<BodyShapeType>(lockedBodyShape ?? BodyShapeType.BOTH)
  const [keepThumbnail, setKeepThumbnail] = useState(true)
  const [category, setCategory] = useState<string | null>(null)
  const [isSaving, setSaving] = useState(false)
  const [isDiscardOpen, setDiscardOpen] = useState(false)
  // A file picked after the modal closed must not land in state; a texture thumbnail padded for a pick
  // that was changed again meanwhile must not either.
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
      const shape = lockedBodyShape ?? getDefaultBodyShape(item, next)
      const itemCategory = item.data.category ?? null
      const baseId = crypto.randomUUID()
      const preview = previewFor(baseId, next, shape)
      const base: PreviewDraft = {
        id: baseId,
        type: next.type,
        contents: {},
        model: '',
        category: itemCategory,
        rarity: item.rarity ?? DEFAULT_RARITY,
        isSmart: next.isSmart,
        requiredPermissions: next.requiredPermissions,
        metrics: null,
        thumbnail: null,
        isAutoThumbnail: false,
        autoThumbnailCategory: null,
        validationIssues: next.validationIssues,
        ...preview,
        ...(await textureThumbnail(preview, itemCategory))
      }
      if (!mountedRef.current) return
      pickRef.current++
      setFile(picked)
      setLoaded(next)
      setDraft(base)
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
    // Another folder of a two-folder zip is another model: its metrics and render are redone, and the
    // previous folder's are dropped right away so they can't be saved meanwhile.
    if (getBodyShapeTypeFromContents(loaded.contents) !== BodyShapeType.BOTH) return
    const pick = ++pickRef.current
    const preview = previewFor(draft.id.split(':')[0], loaded, value)
    setDraft(current => current && { ...current, ...preview })
    textureThumbnail(preview, item.data.category ?? null)
      .then(patch => {
        if (mountedRef.current && pickRef.current === pick) setDraft(current => current && { ...current, ...patch })
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
    let update: BuiltItem
    try {
      update = await buildModelUpdate(loaded, item, bodyShape, draft.metrics ?? loaded.metrics ?? {})
    } catch (err) {
      reportError(err)
      setSaving(false)
      return
    }
    const thumbnail = keepThumbnail ? (draft.contents[THUMBNAIL_PATH] ?? null) : null
    try {
      await onSave({ update, thumbnail, category: needsCategory ? category : null })
    } catch {
      // The editor reported the failed save; the loaded file stays for another try.
      if (mountedRef.current) setSaving(false)
      return
    }
    track('Change item file', {
      itemId: item.id,
      bodyShape,
      mode,
      fileKind: (file && getExtension(file.name)?.slice(1)) ?? 'unknown',
      thumbnailRegenerated: thumbnail !== null
    })
    onClose()
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
                    <BodyShapePicker
                      value={bodyShape}
                      locked={locked}
                      lockedHint={lockHint ?? t('item_editor.change_file.locked_hint')}
                      onChange={pickShape}
                    />
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

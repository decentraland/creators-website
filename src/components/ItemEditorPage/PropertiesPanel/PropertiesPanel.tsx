import { useEffect, useMemo, useRef, useState, type Dispatch } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  CameraAlt as CameraIcon,
  ChangeHistory as TriangleIcon,
  Circle as MaterialIcon,
  PlayArrow as PlayIcon,
  ReportProblemOutlined as WarningIcon,
  Storage as SizeIcon,
  VideocamOutlined as VideoIcon,
  SwapHorizOutlined as ChangeFileIcon,
  Texture as TextureIcon,
  ThirtyFpsSelect as FpsIcon
} from '@mui/icons-material'
import { ActionsMenu, ActionsMenuDivider, ActionsMenuItem } from '~/components/ActionsMenu'
import { Button } from '~/components/Button'
import { CategorySelect } from '~/components/CategorySelect'
import { ConfirmModal } from '~/components/ConfirmModal'
import { HidesEditor } from '~/components/HidesEditor'
import { ClockIcon, ImageIcon, LoopIcon, PlayOnceIcon, SmartIcon } from '~/components/Icons'
import { ItemThumbnail } from '~/components/ItemThumbnail'
import { RaritySelect } from '~/components/RaritySelect'
import { RequiredPermissions } from '~/components/RequiredPermissions'
import { SpringBonesEditor, type SpringBonesModel } from '~/components/SpringBonesEditor'
import { Switch } from '~/components/Switch'
import { ThumbnailModal } from '~/components/ThumbnailModal'
import { InfoTooltip, Tooltip } from '~/components/Tooltip'
import { VideoDropzone, VideoModal } from '~/components/VideoModal'
import { useObjectURL } from '~/hooks/useObjectURL'
import { useDeleteItem, useItemContents } from '~/hooks/usePublishCollection'
import { useTranslation } from '~/intl'
import { fetchContent, fetchItemContents, getContentsStorageUrl } from '~/lib/builder'
import {
  ITEM_DESCRIPTION_MAX_LENGTH,
  ITEM_UTILITY_MAX_LENGTH,
  canUpdateVideo,
  type ItemDraft,
  type ItemDraftAction
} from '~/lib/itemDraft'
import { buildItemZip, getItemZipName } from '~/lib/itemDownload'
import { EmotePlayMode, ITEM_NAME_MAX_LENGTH, isValidItemName } from '~/lib/itemFactory'
import {
  ITEM_EXTENSIONS,
  ItemFileError,
  MAX_THUMBNAIL_FILE_SIZE,
  THUMBNAIL_PATH,
  VIDEO_PATH,
  toMB
} from '~/lib/itemFiles'
import { importItemModel, type ModelImportKind } from '~/lib/itemModelImport'
import { ItemType, getMissingBodyShapeType, isMissingSmartWearableVideo, isSmartWearable, type Item } from '~/lib/items'
import { ImageType, getImageType, resizeImage } from '~/lib/media'
import { downloadBlob } from '~/lib/navigation'
import { useNotifications } from '~/lib/notifications'
import { type SpringBoneParamsByName } from '~/lib/springBones'
import { getEmoteCategoryOptions, getWearableCategoryOptions, isImageWearableContents } from '~/lib/wearableCategories'
import { DeleteItemModal } from '~/components/CollectionDetailPage/DeleteItemModal'
import { EditorSection } from '../EditorSection'
import { TagsInput } from './TagsInput'
import * as S from '../ItemEditorPage.styles'

const THUMBNAIL_SIZE = 1024

export type SpringBonesFormProps = {
  models: SpringBonesModel[]
  params: SpringBoneParamsByName
  activeHash: string
  onActiveHashChange: (hash: string) => void
  onChange: (params: SpringBoneParamsByName) => void
}

type Props = {
  item: Item
  address: string
  /** False in review mode, for viewers without edit rights, and while the collection is publish-locked. */
  editable: boolean
  /** Owner of a draft collection: the only one who may delete items here. */
  canDelete: boolean
  draft: ItemDraft
  dispatch: Dispatch<ItemDraftAction>
  isDirty: boolean
  isSaving: boolean
  springBones: SpringBonesFormProps | null
  onSave: () => void
  onRevert: () => void
  onDeleted: () => void
  testId?: string
}

export function PropertiesPanel({
  item,
  address,
  editable,
  canDelete,
  draft,
  dispatch,
  isDirty,
  isSaving,
  springBones,
  onSave,
  onRevert,
  onDeleted,
  testId = 'properties-panel'
}: Props) {
  const { t } = useTranslation()
  const showToast = useNotifications(state => state.showToast)
  const thumbnailInputRef = useRef<HTMLInputElement>(null)
  const modelInputRef = useRef<HTMLInputElement>(null)
  const [modelImport, setModelImport] = useState<ModelImportKind | null>(null)
  const [isImporting, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [isThumbnailOpen, setThumbnailOpen] = useState(false)
  const [isVideoOpen, setVideoOpen] = useState(false)
  const [isDeleteOpen, setDeleteOpen] = useState(false)
  const [isDownloading, setDownloading] = useState(false)
  const deleteItem = useDeleteItem(address)
  const itemContents = useItemContents(isThumbnailOpen ? item : null)

  const isEmote = item.type === ItemType.EMOTE
  const isWearable = item.type === ItemType.WEARABLE
  const isSmart = isSmartWearable(item)
  const disabled = !editable
  const contents = draft.fileUpdate?.item.contents ?? item.contents
  const categories = useMemo(
    () => (isEmote ? getEmoteCategoryOptions() : getWearableCategoryOptions(contents)),
    [isEmote, contents]
  )
  // Texture-only wearables have nothing to pose in the thumbnail modal: they take a PNG straight from disk.
  const isImageWearable = isWearable && isImageWearableContents(item.contents)
  const missingShape = useMemo(
    () => (isWearable && !isSmart ? getMissingBodyShapeType(item) : null),
    [isWearable, isSmart, item]
  )
  const nameInvalid = draft.name.length > 0 && !isValidItemName(draft.name)
  const thumbnailUrl = useObjectURL(draft.thumbnail)
  const thumbnailHash = item.contents[item.thumbnail]
  const videoHash = item.contents[VIDEO_PATH]
  const draftVideoUrl = useObjectURL(draft.video)
  const videoUrl = draftVideoUrl ?? (videoHash ? getContentsStorageUrl(videoHash) : null)
  const canEditVideo = editable && canUpdateVideo(item)
  const videoName = draft.video instanceof File ? draft.video.name : VIDEO_PATH
  const [videoDuration, setVideoDuration] = useState<number | null>(null)
  // A new video must not flash the previous one's duration until its metadata loads.
  useEffect(() => setVideoDuration(null), [videoUrl])
  const storedVideo = useQuery({
    queryKey: ['item-video', videoHash],
    queryFn: () => fetchContent(videoHash),
    enabled: isVideoOpen && !draft.video && !!videoHash,
    staleTime: Infinity
  })
  const metrics = draft.fileUpdate?.item.metrics ?? item.metrics

  async function onThumbnailFile(file: File | undefined) {
    if (!file) return
    try {
      if ((await getImageType(file)) !== ImageType.PNG) throw new Error('format')
      const resized = await resizeImage(file, THUMBNAIL_SIZE, THUMBNAIL_SIZE)
      if (resized.size > MAX_THUMBNAIL_FILE_SIZE) throw new Error('size')
      dispatch({ type: 'setThumbnail', thumbnail: resized })
    } catch (error) {
      const key =
        error instanceof Error && error.message === 'format'
          ? 'thumbnail_modal.wrong_format'
          : 'thumbnail_modal.too_big'
      showToast(t(key, { size: toMB(MAX_THUMBNAIL_FILE_SIZE) }), { type: 'error' })
    }
  }

  function startModelImport(kind: ModelImportKind) {
    setModelImport(kind)
    modelInputRef.current?.click()
  }

  async function onModelFile(file: File | undefined) {
    const kind = modelImport
    setModelImport(null)
    if (!file || !kind) return
    setImporting(true)
    try {
      dispatch({ type: 'setFileUpdate', update: await importItemModel(file, item, kind) })
    } catch (error) {
      const key = error instanceof ItemFileError ? error.messageKey : 'invalid_model_file'
      const params = error instanceof ItemFileError ? error.messageParams : undefined
      if (!(error instanceof ItemFileError)) console.error('Model import failed:', error)
      setImportError(t(`add_items_modal.file_error.${key}`, params))
    } finally {
      setImporting(false)
    }
  }

  async function download() {
    setDownloading(true)
    try {
      downloadBlob(await buildItemZip(await fetchItemContents(item)), getItemZipName(item))
    } catch (error) {
      console.error('Item download failed:', error)
      showToast(t('item_editor.details.download_error'), { type: 'error' })
    } finally {
      setDownloading(false)
    }
  }

  function confirmDelete() {
    deleteItem.mutate(item, {
      onSuccess: () => {
        setDeleteOpen(false)
        showToast(t('collection_detail_page.item_actions.deleted', { name: item.name }))
        onDeleted()
      }
    })
  }

  return (
    <S.PanelBody data-testid={testId} data-editable={editable || undefined}>
      <S.PanelHeader data-testid={`${testId}-header`}>
        <S.PanelTitle title={item.name}>{item.name}</S.PanelTitle>
        {isSmart && (
          <Tooltip content={t('collection_detail_page.smart_wearable')} asChild testId={`${testId}-smart-tooltip`}>
            <S.SmartBadge data-testid={`${testId}-smart`} tabIndex={0}>
              <SmartIcon />
            </S.SmartBadge>
          </Tooltip>
        )}
        <ActionsMenu label={t('item_editor.actions.label')} variant="row" tone="dark" testId={`${testId}-actions`}>
          <ActionsMenuItem testId={`${testId}-download`} disabled={isDownloading} onClick={() => void download()}>
            {t('item_editor.details.download')}
          </ActionsMenuItem>
          {editable && (
            <ActionsMenuItem
              testId={`${testId}-change-file`}
              disabled={isImporting}
              onClick={() => startModelImport({ kind: 'replace' })}
            >
              {t('item_editor.details.change_file')}
            </ActionsMenuItem>
          )}
          {editable && missingShape && (
            <ActionsMenuItem
              testId={`${testId}-add-representation`}
              disabled={isImporting}
              onClick={() => startModelImport({ kind: 'add-representation', bodyShape: missingShape })}
            >
              {t('item_editor.details.add_representation', {
                shape: t(`add_items_modal.body_shape_option.${missingShape}`)
              })}
            </ActionsMenuItem>
          )}
          {canDelete && (
            <>
              <ActionsMenuDivider />
              <ActionsMenuItem testId={`${testId}-delete`} onClick={() => setDeleteOpen(true)}>
                {t('item_editor.danger.delete')}
              </ActionsMenuItem>
            </>
          )}
        </ActionsMenu>
      </S.PanelHeader>
      {!editable && <S.ReadOnlyNote data-testid={`${testId}-readonly`}>{t('item_editor.read_only')}</S.ReadOnlyNote>}

      <EditorSection title={t('item_editor.details.title')} testId={`${testId}-details`}>
        <S.DetailsRow>
          <S.ThumbButton
            type="button"
            aria-label={t('item_editor.details.edit_thumbnail')}
            disabled={disabled}
            data-testid={`${testId}-thumbnail`}
            onClick={() => (isImageWearable ? thumbnailInputRef.current?.click() : setThumbnailOpen(true))}
          >
            <ItemThumbnail
              src={thumbnailUrl ?? (thumbnailHash ? getContentsStorageUrl(thumbnailHash) : null)}
              rarity={item.rarity}
            />
            {editable && (
              <S.ThumbOverlay aria-hidden>
                <CameraIcon />
              </S.ThumbOverlay>
            )}
          </S.ThumbButton>
          {metrics && (
            <S.Metrics data-testid={`${testId}-metrics`}>
              {isEmote ? (
                <>
                  <S.Metric>
                    <ClockIcon />
                    {t('add_items_modal.metrics.duration', { count: Math.round((metrics.duration ?? 0) * 10) / 10 })}
                  </S.Metric>
                  <S.Metric>
                    <ImageIcon />
                    {t('add_items_modal.metrics.frames', { count: metrics.frames ?? 0 })}
                  </S.Metric>
                  <S.Metric>
                    <FpsIcon />
                    {t('add_items_modal.metrics.fps', { count: Math.round((metrics.fps ?? 0) * 10) / 10 })}
                  </S.Metric>
                </>
              ) : (
                <>
                  <S.Metric>
                    <TriangleIcon />
                    {t('add_items_modal.metrics.triangles', { count: metrics.triangles ?? 0 })}
                  </S.Metric>
                  <S.Metric>
                    <MaterialIcon />
                    {t('add_items_modal.metrics.materials', { count: metrics.materials ?? 0 })}
                  </S.Metric>
                  <S.Metric>
                    <TextureIcon />
                    {t('add_items_modal.metrics.textures', { count: metrics.textures ?? 0 })}
                  </S.Metric>
                </>
              )}
            </S.Metrics>
          )}
        </S.DetailsRow>
        {draft.fileUpdate && (
          <S.Warning data-testid={`${testId}-file-update`}>
            <ChangeFileIcon fontSize="small" />
            {t('item_editor.details.file_update_pending')}
          </S.Warning>
        )}
        {isSmart && (
          <S.VideoPane data-testid={`${testId}-video`}>
            <S.FieldLabel>
              <S.LabelText>
                {t('add_items_modal.video.label')}
                <InfoTooltip content={t('item_editor.details.video_hint')} testId={`${testId}-video-hint`} />
              </S.LabelText>
            </S.FieldLabel>
            {videoUrl ? (
              <S.DetailsRow>
                <S.ThumbButton
                  type="button"
                  aria-label={t('add_items_modal.video.edit')}
                  disabled={!canEditVideo}
                  data-testid={`${testId}-video-preview`}
                  onClick={() => setVideoOpen(true)}
                >
                  <S.VideoPoster
                    key={videoUrl}
                    src={videoUrl}
                    preload="metadata"
                    muted
                    playsInline
                    onLoadedMetadata={event => {
                      const { duration } = event.currentTarget
                      setVideoDuration(Number.isFinite(duration) ? duration : null)
                    }}
                  />
                  {/* Storage streams the mp4 without ranges, so the first frame can take a while: mark the wait. */}
                  {videoDuration === null ? (
                    <S.PosterPlaceholder aria-hidden data-testid={`${testId}-video-loading`}>
                      <VideoIcon />
                    </S.PosterPlaceholder>
                  ) : (
                    <S.PlayBadge aria-hidden>
                      <PlayIcon />
                    </S.PlayBadge>
                  )}
                  {canEditVideo && (
                    <S.ThumbOverlay aria-hidden>
                      <VideoIcon />
                    </S.ThumbOverlay>
                  )}
                </S.ThumbButton>
                <S.Metrics data-testid={`${testId}-video-meta`}>
                  <S.Metric>
                    <VideoIcon />
                    <S.MetricText title={videoName}>{videoName}</S.MetricText>
                  </S.Metric>
                  {videoDuration !== null && (
                    <S.Metric>
                      <ClockIcon />
                      {t('add_items_modal.video.duration', { seconds: Math.round(videoDuration) })}
                    </S.Metric>
                  )}
                  {draft.video && (
                    <S.Metric>
                      <SizeIcon />
                      {t('add_items_modal.video.size', { size: toMB(draft.video.size) })}
                    </S.Metric>
                  )}
                </S.Metrics>
              </S.DetailsRow>
            ) : canEditVideo ? (
              <VideoDropzone
                compact
                testId={`${testId}-video-dropzone`}
                onPick={video => dispatch({ type: 'setVideo', video })}
              />
            ) : null}
            {isMissingSmartWearableVideo(item) && !draft.video && (
              <S.Warning data-testid={`${testId}-video-missing`}>
                <WarningIcon fontSize="small" />
                {t('item_editor.details.video_required')}
              </S.Warning>
            )}
          </S.VideoPane>
        )}
      </EditorSection>

      <EditorSection title={t('item_editor.basics.title')} testId={`${testId}-basics`}>
        <S.Field>
          <S.FieldLabel>
            {t('item_editor.basics.name')}
            <S.CharCount>
              {t('add_items_modal.char_count', { count: draft.name.length, max: ITEM_NAME_MAX_LENGTH })}
            </S.CharCount>
          </S.FieldLabel>
          <S.TextInput
            value={draft.name}
            maxLength={ITEM_NAME_MAX_LENGTH}
            disabled={disabled}
            data-invalid={nameInvalid || undefined}
            data-testid={`${testId}-name`}
            onChange={event => dispatch({ type: 'setText', field: 'name', value: event.target.value })}
          />
          {nameInvalid && (
            <S.ErrorText data-testid={`${testId}-name-error`}>{t('add_items_modal.invalid_name')}</S.ErrorText>
          )}
        </S.Field>
        <S.Field>
          <S.FieldLabel>
            {t('item_editor.basics.description')}
            <S.CharCount>
              {t('add_items_modal.char_count', { count: draft.description.length, max: ITEM_DESCRIPTION_MAX_LENGTH })}
            </S.CharCount>
          </S.FieldLabel>
          <S.TextArea
            value={draft.description}
            maxLength={ITEM_DESCRIPTION_MAX_LENGTH}
            disabled={disabled}
            data-testid={`${testId}-description`}
            onChange={event => dispatch({ type: 'setText', field: 'description', value: event.target.value })}
          />
        </S.Field>
        {isWearable && (
          <S.Field>
            <S.FieldLabel>
              <S.LabelText>
                {t('item_editor.basics.utility')}{' '}
                <InfoTooltip content={t('item_editor.basics.utility_hint')} testId={`${testId}-utility-hint`} />
              </S.LabelText>
              <S.CharCount>
                {t('add_items_modal.char_count', { count: draft.utility.length, max: ITEM_UTILITY_MAX_LENGTH })}
              </S.CharCount>
            </S.FieldLabel>
            <S.TextInput
              value={draft.utility}
              maxLength={ITEM_UTILITY_MAX_LENGTH}
              disabled={disabled}
              data-testid={`${testId}-utility`}
              onChange={event => dispatch({ type: 'setText', field: 'utility', value: event.target.value })}
            />
          </S.Field>
        )}
        <S.Field as="div">
          <S.FieldLabel>{t('item_editor.basics.category')}</S.FieldLabel>
          <CategorySelect
            value={draft.category}
            categories={categories}
            disabled={disabled}
            tone="dark"
            testId={`${testId}-category`}
            onChange={category => dispatch({ type: 'setCategory', category })}
          />
        </S.Field>
        <S.Field as="div">
          <S.FieldLabel>
            <S.LabelText>
              {t('item_editor.basics.rarity')}{' '}
              <InfoTooltip content={t('add_items_modal.rarity_tooltip')} testId={`${testId}-rarity-hint`} />
            </S.LabelText>
          </S.FieldLabel>
          <RaritySelect
            value={draft.rarity ?? ''}
            disabled={disabled || item.isPublished}
            tone="dark"
            testId={`${testId}-rarity`}
            onChange={rarity => dispatch({ type: 'setRarity', rarity })}
          />
        </S.Field>
      </EditorSection>

      {isWearable && (
        <EditorSection title={t('item_editor.overrides.title')} testId={`${testId}-overrides`}>
          <HidesEditor
            contents={contents}
            category={draft.category}
            hides={draft.hides}
            disabled={disabled}
            testId={`${testId}-hides`}
            onChange={hides => dispatch({ type: 'setHides', hides })}
          />
        </EditorSection>
      )}

      {isEmote && (
        <EditorSection title={t('item_editor.animation.title')} testId={`${testId}-animation`}>
          <S.Segmented role="radiogroup" aria-label={t('add_items_modal.play_mode')}>
            {[EmotePlayMode.LOOP, EmotePlayMode.SIMPLE].map(mode => {
              const selected = draft.loop === (mode === EmotePlayMode.LOOP)
              return (
                <S.SegmentButton
                  key={mode}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={disabled}
                  data-selected={selected || undefined}
                  data-testid={`${testId}-play-mode-${mode}`}
                  onClick={() => dispatch({ type: 'setLoop', loop: mode === EmotePlayMode.LOOP })}
                >
                  {mode === EmotePlayMode.LOOP ? <LoopIcon /> : <PlayOnceIcon />}
                  {t(`add_items_modal.play_mode_option.${mode}`)}
                </S.SegmentButton>
              )
            })}
          </S.Segmented>
        </EditorSection>
      )}

      {springBones && springBones.models.length > 0 && (
        <EditorSection title={t('item_editor.spring_bones.title')} testId={`${testId}-spring-bones`}>
          <SpringBonesEditor
            models={springBones.models}
            activeHash={springBones.activeHash}
            onActiveHashChange={springBones.onActiveHashChange}
            params={springBones.params}
            onChange={springBones.onChange}
            disabled={disabled}
          />
        </EditorSection>
      )}

      {isSmart && (
        <EditorSection title={t('required_permissions.title')} testId={`${testId}-permissions`}>
          <RequiredPermissions
            permissions={item.data.requiredPermissions ?? []}
            testId={`${testId}-required-permissions`}
          />
        </EditorSection>
      )}

      <EditorSection title={t('item_editor.tags.title')} testId={`${testId}-tags`}>
        <TagsInput tags={draft.tags} disabled={disabled} onChange={tags => dispatch({ type: 'setTags', tags })} />
      </EditorSection>

      {isWearable && (
        <EditorSection title={t('item_editor.options.title')} testId={`${testId}-options`}>
          <S.Toggle>
            <S.LabelText>
              {t('item_editor.options.vrm_export')}
              <InfoTooltip content={t('item_editor.options.vrm_export_hint')} testId={`${testId}-vrm-hint`} />
            </S.LabelText>
            <Switch
              checked={!draft.blockVrmExport}
              disabled={disabled}
              label={t('item_editor.options.vrm_export')}
              testId={`${testId}-vrm-export`}
              onChange={checked => dispatch({ type: 'setFlag', field: 'blockVrmExport', value: !checked })}
            />
          </S.Toggle>
          <S.Toggle>
            <S.LabelText>
              {t('item_editor.options.outline')}
              <InfoTooltip content={t('item_editor.options.outline_hint')} testId={`${testId}-outline-hint`} />
            </S.LabelText>
            <Switch
              checked={draft.outlineCompatible}
              disabled={disabled}
              label={t('item_editor.options.outline')}
              testId={`${testId}-outline`}
              onChange={checked => dispatch({ type: 'setFlag', field: 'outlineCompatible', value: checked })}
            />
          </S.Toggle>
        </EditorSection>
      )}

      {editable && isDirty && (
        <S.Footer data-testid={`${testId}-footer`}>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={!isDirty || isSaving}
            data-testid={`${testId}-revert`}
            onClick={onRevert}
          >
            {t('item_editor.revert')}
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={!isDirty || nameInvalid || draft.name.trim() === ''}
            loading={isSaving}
            data-testid={`${testId}-save`}
            onClick={onSave}
          >
            {t('item_editor.save')}
          </Button>
        </S.Footer>
      )}

      <input
        ref={thumbnailInputRef}
        type="file"
        accept="image/png"
        hidden
        data-testid={`${testId}-thumbnail-input`}
        onChange={event => {
          void onThumbnailFile(event.target.files?.[0])
          event.target.value = ''
        }}
      />
      <input
        ref={modelInputRef}
        type="file"
        accept={ITEM_EXTENSIONS.join(',')}
        hidden
        data-testid={`${testId}-model-input`}
        onChange={event => {
          void onModelFile(event.target.files?.[0])
          event.target.value = ''
        }}
      />

      {isThumbnailOpen && (
        <ThumbnailModal
          type={item.type}
          contents={itemContents.data ?? null}
          loadError={itemContents.isError}
          onClose={() => setThumbnailOpen(false)}
          onSave={patch => {
            dispatch({ type: 'setThumbnail', thumbnail: patch.contents[THUMBNAIL_PATH] })
            setThumbnailOpen(false)
          }}
        />
      )}
      {isVideoOpen && (
        <VideoModal
          video={draft.video ?? storedVideo.data ?? null}
          onChange={video => dispatch({ type: 'setVideo', video })}
          onClose={() => setVideoOpen(false)}
        />
      )}
      {importError && (
        <ConfirmModal
          title={t('item_editor.details.import_error_title')}
          description={importError}
          onClose={() => setImportError(null)}
          confirm={{
            label: t('item_editor.details.import_error_close'),
            onClick: () => setImportError(null),
            testId: `${testId}-import-error-close`
          }}
          testId={`${testId}-import-error`}
        />
      )}
      {isDeleteOpen && (
        <DeleteItemModal
          item={item}
          isDeleting={deleteItem.isPending}
          error={deleteItem.isError}
          onCancel={() => {
            setDeleteOpen(false)
            deleteItem.reset()
          }}
          onConfirm={confirmDelete}
        />
      )}
    </S.PanelBody>
  )
}

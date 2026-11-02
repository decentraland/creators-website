import { useEffect, useMemo, useState } from 'react'
import {
  ErrorOutline as HintIcon,
  InfoOutlined as InfoIcon,
  PlayArrow as PlayIcon,
  VideocamOutlined as VideoIcon
} from '@mui/icons-material'
import { CategorySelect } from '~/components/CategorySelect'
import { LoopIcon, PlayOnceIcon } from '~/components/Icons'
import { RaritySelect } from '~/components/RaritySelect'
import { InfoTooltip, Tooltip } from '~/components/Tooltip'
import { VideoDropzone } from '~/components/VideoModal'
import { useObjectURL } from '~/hooks/useObjectURL'
import { useTranslation } from '~/intl'
import { EmotePlayMode, ITEM_NAME_MAX_LENGTH, getSizeError, isValidItemName } from '~/lib/itemFactory'
import { toMB } from '~/lib/itemFiles'
import { BodyShapeType, ItemType, VIDEO_PATH, type Item } from '~/lib/items'
import { type Mapping } from '~/lib/mappings'
import { decodeLinkedUrn, type LinkedContract } from '~/lib/thirdParty'
import { MappingEditor } from '~/components/MappingEditor'
import { getCategoryOptions, getVariantTargets, type ItemDraft } from './AddItemsModal.state'
import { BodyShapePicker, DraftPreviewPane } from '~/components/ItemDraftModal'
import * as S from './AddItemsModal.styles'

type Props = {
  draft: ItemDraft
  drafts: ItemDraft[]
  collectionItems: Item[]
  onUpdate: (id: string, patch: Partial<ItemDraft>) => void
  onOpenThumbnail: () => void
  /** Smart wearables only: opens the preview video overlay. */
  onOpenVideo: () => void
  /** Smart wearables only: a picked file replaces the preview video. */
  onVideoChange: (video: File) => void
  /** Linked collections: no rarity, and the mapping field when the collection has a linked contract. */
  linked?: { contract: LinkedContract | null; updating?: boolean }
}

export function DraftForm({
  draft,
  drafts,
  collectionItems,
  onUpdate,
  onOpenThumbnail,
  onOpenVideo,
  onVideoChange,
  linked
}: Props) {
  const { t } = useTranslation()

  const isEmote = draft.type === ItemType.EMOTE
  const isWearable = draft.type === ItemType.WEARABLE
  const isSmart = isWearable && draft.isSmart
  const bodyShapeHint = isEmote
    ? 'add_items_modal.body_shape_emote_hint'
    : isSmart
      ? 'add_items_modal.body_shape_smart_hint'
      : null
  const isSingleShape = isWearable && draft.bodyShape !== BodyShapeType.BOTH
  const variantTargets = useMemo(
    () => (isSingleShape ? getVariantTargets(draft, drafts, collectionItems) : []),
    [isSingleShape, draft, drafts, collectionItems]
  )
  // Edit in bulk: the item this zip's wearable.json names, once the zip has been read.
  const updatedItem = useMemo(
    () =>
      linked?.updating && draft.urnSuffix
        ? collectionItems.find(item => decodeLinkedUrn(item.urn)?.itemSuffix === draft.urnSuffix)
        : undefined,
    [linked?.updating, draft.urnSuffix, collectionItems]
  )
  const variantTargetShape = draft.bodyShape === BodyShapeType.MALE ? BodyShapeType.FEMALE : BodyShapeType.MALE
  const showItemFields = !draft.isVariant
  const sizeError = useMemo(
    () => (draft.type ? getSizeError(draft.type, draft.category ?? undefined, draft.contents) : null),
    [draft.type, draft.category, draft.contents]
  )
  const nameInvalid = draft.name.length > 0 && !isValidItemName(draft.name)
  const categories = useMemo(() => getCategoryOptions(draft), [draft])

  const video = draft.contents[VIDEO_PATH]
  const videoUrl = useObjectURL(video)
  const [videoDuration, setVideoDuration] = useState<number | null>(null)
  // A new video (or draft) must not flash the previous one's duration until its metadata loads.
  useEffect(() => setVideoDuration(null), [videoUrl])

  return (
    <S.Content data-testid="draft-form">
      <DraftPreviewPane draft={draft} thumbnailLocked={draft.isVariant} onOpenThumbnail={onOpenThumbnail} />

      <S.FormPane>
        <S.FormHeading>
          {t(linked?.updating ? 'add_items_modal.bulk_edit.form_heading' : 'add_items_modal.form_heading')}
        </S.FormHeading>
        {updatedItem?.urn && (
          <S.FieldHint data-testid="bulk-edit-target" title={updatedItem.urn}>
            <InfoIcon />
            {t('add_items_modal.bulk_edit.target', {
              name: updatedItem.name,
              urn: decodeLinkedUrn(updatedItem.urn)?.itemSuffix ?? updatedItem.urn
            })}
          </S.FieldHint>
        )}

        {showItemFields && (
          <S.Field>
            {t('add_items_modal.item_name')}
            <S.TextInputBox data-invalid={nameInvalid || undefined}>
              <input
                value={draft.name}
                maxLength={ITEM_NAME_MAX_LENGTH}
                placeholder={t('add_items_modal.item_name_placeholder')}
                data-testid="item-name"
                data-invalid={nameInvalid || undefined}
                onChange={event => onUpdate(draft.id, { name: event.target.value })}
              />
              <S.CharCount data-testid="item-name-count">
                {t('add_items_modal.char_count', { count: draft.name.length, max: ITEM_NAME_MAX_LENGTH })}
              </S.CharCount>
            </S.TextInputBox>
            {nameInvalid && <S.ErrorText>{t('add_items_modal.invalid_name')}</S.ErrorText>}
          </S.Field>
        )}

        {(isWearable || isEmote) && (
          <S.Field as="div" data-hinted={bodyShapeHint ? true : undefined}>
            {bodyShapeHint ? (
              <S.FieldLabel>
                {t('add_items_modal.body_shape')}
                <S.FieldHint data-testid="body-shape-hint">
                  <HintIcon />
                  {t(bodyShapeHint)}
                </S.FieldHint>
              </S.FieldLabel>
            ) : (
              t('add_items_modal.body_shape')
            )}
            <BodyShapePicker
              value={draft.bodyShape}
              locked={draft.bodyShapeLocked}
              lockedHint={bodyShapeHint ? t(bodyShapeHint) : null}
              onChange={value =>
                onUpdate(draft.id, {
                  bodyShape: value,
                  // Going back to BOTH clears the variant answer entirely.
                  ...(value === BodyShapeType.BOTH
                    ? { isVariant: false, variantTargetId: null }
                    : { variantTargetId: null })
                })
              }
            />
          </S.Field>
        )}

        {isSingleShape && (
          <S.Field as="div">
            {t('add_items_modal.variant_question')}
            <S.Segmented data-joined role="radiogroup" aria-label={t('add_items_modal.variant_question')}>
              {[true, false].map(answer => (
                <S.SegmentButton
                  key={String(answer)}
                  type="button"
                  role="radio"
                  aria-checked={draft.isVariant === answer}
                  data-selected={draft.isVariant === answer || undefined}
                  data-testid={`variant-${answer ? 'yes' : 'no'}`}
                  onClick={() => onUpdate(draft.id, { isVariant: answer, variantTargetId: null })}
                >
                  {t(answer ? 'add_items_modal.yes' : 'add_items_modal.no')}
                </S.SegmentButton>
              ))}
            </S.Segmented>
          </S.Field>
        )}

        {draft.isVariant && variantTargets.length === 0 && (
          <S.WarningCard data-testid="variant-target-empty">
            <InfoIcon />
            {t('add_items_modal.no_variant_targets', {
              bodyShape: t(`add_items_modal.body_shape_option.${variantTargetShape}`)
            })}
          </S.WarningCard>
        )}

        {draft.isVariant && variantTargets.length > 0 && (
          <S.Field as="div">
            <S.Select
              value={draft.variantTargetId ?? ''}
              aria-label={t('add_items_modal.select_item')}
              data-testid="variant-target"
              onChange={event => onUpdate(draft.id, { variantTargetId: event.target.value || null })}
            >
              <option value="">{t('add_items_modal.select_item')}</option>
              {variantTargets.map(target => (
                <option key={target.id} value={target.id}>
                  {t('add_items_modal.variant_target_label', {
                    name: target.label,
                    bodyShape: t(`add_items_modal.body_shape_option.${target.bodyShape}`)
                  })}
                </option>
              ))}
            </S.Select>
          </S.Field>
        )}

        {isEmote && showItemFields && (
          <S.Field as="div">
            {t('add_items_modal.play_mode')}
            <S.Segmented role="radiogroup" aria-label={t('add_items_modal.play_mode')}>
              {[EmotePlayMode.LOOP, EmotePlayMode.SIMPLE].map(mode => (
                <Tooltip
                  key={mode}
                  content={t(`add_items_modal.play_mode_tooltip.${mode}`)}
                  asChild
                  testId={`play-mode-${mode}-tooltip`}
                >
                  <S.SegmentButton
                    type="button"
                    role="radio"
                    aria-checked={draft.playMode === mode}
                    data-selected={draft.playMode === mode || undefined}
                    data-testid={`play-mode-${mode}`}
                    onClick={() => onUpdate(draft.id, { playMode: mode })}
                  >
                    {mode === EmotePlayMode.LOOP ? <LoopIcon /> : <PlayOnceIcon />}
                    {t(`add_items_modal.play_mode_option.${mode}`)}
                  </S.SegmentButton>
                </Tooltip>
              ))}
            </S.Segmented>
          </S.Field>
        )}

        {showItemFields && (
          <S.FieldRow>
            <S.Field>
              {t('add_items_modal.category')}
              <CategorySelect
                value={draft.category}
                categories={categories}
                testId="item-category"
                onChange={category => onUpdate(draft.id, { category })}
              />
              {isWearable && draft.suggestedCategory !== null && draft.category === draft.suggestedCategory && (
                <S.FieldHint data-testid="suggested-category">
                  <HintIcon />
                  {t('add_items_modal.suggested_category', {
                    category: t(`collection_detail_page.category.${draft.suggestedCategory}`)
                  })}
                </S.FieldHint>
              )}
            </S.Field>
            {!linked && (
              <S.Field>
                <S.FieldLabelRow>
                  {t('add_items_modal.rarity')}
                  <InfoTooltip content={t('add_items_modal.rarity_tooltip')} testId="rarity-tooltip" />
                </S.FieldLabelRow>
                <RaritySelect
                  value={draft.rarity}
                  testId="item-rarity"
                  onChange={rarity => onUpdate(draft.id, { rarity })}
                />
              </S.Field>
            )}
          </S.FieldRow>
        )}

        {showItemFields && linked?.contract && (
          <S.Field as="div" data-testid="draft-mapping-field">
            <S.FieldLabel>
              {t('mapping_editor.label')}
              <S.FieldHint>{t('add_items_modal.mapping_hint')}</S.FieldHint>
            </S.FieldLabel>
            <MappingEditor
              key={draft.id}
              value={draft.mapping}
              testId="draft-mapping"
              onChange={(mapping: Mapping | null) => onUpdate(draft.id, { mapping })}
            />
          </S.Field>
        )}

        {isSmart && (
          <S.Field as="div" data-testid="draft-video-field">
            <S.FieldLabel>
              {t('add_items_modal.video.label')}
              <S.FieldHint>{t('add_items_modal.video.field_hint')}</S.FieldHint>
            </S.FieldLabel>
            <VideoDropzone compact testId="draft-video" onPick={onVideoChange}>
              {video && videoUrl && (
                <>
                  <S.VideoPoster
                    type="button"
                    aria-label={t('add_items_modal.video.edit')}
                    data-testid="draft-video-preview"
                    onClick={onOpenVideo}
                  >
                    <video
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
                    <S.VideoPlay>
                      <PlayIcon />
                    </S.VideoPlay>
                    <S.VideoPosterOverlay data-video-overlay>
                      <VideoIcon />
                    </S.VideoPosterOverlay>
                  </S.VideoPoster>
                  <S.VideoInfo>
                    <S.VideoName>{video instanceof File ? video.name : VIDEO_PATH}</S.VideoName>
                    <S.VideoMeta data-testid="draft-video-meta">
                      {videoDuration !== null && (
                        <span>{t('add_items_modal.video.duration', { seconds: Math.round(videoDuration) })}</span>
                      )}
                      <span>{t('add_items_modal.video.size', { size: toMB(video.size) })}</span>
                    </S.VideoMeta>
                  </S.VideoInfo>
                </>
              )}
            </VideoDropzone>
          </S.Field>
        )}

        {sizeError !== null && (
          <S.ErrorText data-testid="size-error">
            {t('add_items_modal.file_error.size_exceeded', { size: sizeError })}
          </S.ErrorText>
        )}
      </S.FormPane>
    </S.Content>
  )
}

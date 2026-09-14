import { useMemo, type ReactNode } from 'react'
import {
  CameraAlt as CameraIcon,
  ChangeHistory as TriangleIcon,
  Circle as MaterialIcon,
  ErrorOutline as HintIcon,
  Female as FemaleIcon,
  InfoOutlined as InfoIcon,
  Male as MaleIcon,
  ReportProblemOutlined as WarningIcon,
  Texture as TextureIcon,
  ThirtyFpsSelect as FpsIcon,
  Transgender as BothIcon
} from '@mui/icons-material'
import { CategorySelect } from '~/components/CategorySelect'
import { ItemThumbnail } from '~/components/ItemThumbnail'
import { ClockIcon, FilmReelIcon, ImageIcon, LoopIcon, PlayOnceIcon } from '~/components/Icons'
import { RaritySelect } from '~/components/RaritySelect'
import { RequiredPermissions } from '~/components/RequiredPermissions'
import { InfoTooltip, Tooltip } from '~/components/Tooltip'
import { useTranslation } from '~/intl'
import { EmotePlayMode, ITEM_NAME_MAX_LENGTH, getSizeError, isValidItemName } from '~/lib/itemFactory'
import { BodyShapeType, ItemType, VIDEO_PATH, type Item } from '~/lib/items'
import { getCategoryOptions, getVariantTargets, type ItemDraft } from './AddItemsModal.state'
import * as S from './AddItemsModal.styles'

type Props = {
  draft: ItemDraft
  drafts: ItemDraft[]
  collectionItems: Item[]
  onUpdate: (id: string, patch: Partial<ItemDraft>) => void
  onOpenThumbnail: () => void
}

const BODY_SHAPES: Array<{ value: BodyShapeType; icon: ReactNode }> = [
  { value: BodyShapeType.BOTH, icon: <BothIcon /> },
  { value: BodyShapeType.FEMALE, icon: <FemaleIcon /> },
  { value: BodyShapeType.MALE, icon: <MaleIcon /> }
]

export function DraftForm({ draft, drafts, collectionItems, onUpdate, onOpenThumbnail }: Props) {
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
  const variantTargetShape = draft.bodyShape === BodyShapeType.MALE ? BodyShapeType.FEMALE : BodyShapeType.MALE
  const showItemFields = !draft.isVariant
  const sizeError = useMemo(
    () => (draft.type ? getSizeError(draft.type, draft.category ?? undefined, draft.contents) : null),
    [draft.type, draft.category, draft.contents]
  )
  const nameInvalid = draft.name.length > 0 && !isValidItemName(draft.name)
  const categories = useMemo(() => getCategoryOptions(draft), [draft])

  const warnings = useMemo(() => {
    const list = draft.validationIssues.map(issue => ({
      key: issue.code,
      text: t(`${issue.messageKey}`, issue.messageParams)
    }))
    if (draft.thumbnailNotTransparent) {
      list.push({ key: 'THUMBNAIL_NOT_TRANSPARENT', text: t('item_validation.thumbnail_not_transparent') })
    }
    return list
  }, [draft.validationIssues, draft.thumbnailNotTransparent, t])

  return (
    <S.Content data-testid="draft-form">
      <S.PreviewPane>
        <S.ThumbnailBox
          type="button"
          aria-label={t('add_items_modal.edit_thumbnail')}
          data-testid="edit-thumbnail"
          onClick={onOpenThumbnail}
        >
          <ItemThumbnail src={draft.thumbnail} rarity={draft.rarity} testId="draft-thumbnail">
            <S.ThumbnailOverlay data-thumb-overlay>
              <CameraIcon />
            </S.ThumbnailOverlay>
          </ItemThumbnail>
        </S.ThumbnailBox>
        <S.MetricsRow data-testid="draft-metrics" data-compact={isEmote || undefined}>
          {isEmote && draft.metrics ? (
            <>
              <S.MetricPill>
                <FilmReelIcon />
                {t('add_items_modal.metrics.sequences', { count: draft.metrics.sequences ?? 0 })}
              </S.MetricPill>
              <S.MetricPill>
                <ClockIcon />
                {t('add_items_modal.metrics.duration', { count: Math.round((draft.metrics.duration ?? 0) * 10) / 10 })}
              </S.MetricPill>
              <S.MetricPill>
                <ImageIcon />
                {t('add_items_modal.metrics.frames', { count: draft.metrics.frames ?? 0 })}
              </S.MetricPill>
              <S.MetricPill>
                <FpsIcon />
                {t('add_items_modal.metrics.fps', { count: Math.round((draft.metrics.fps ?? 0) * 10) / 10 })}
              </S.MetricPill>
            </>
          ) : draft.metrics ? (
            <>
              <S.MetricPill>
                <TriangleIcon />
                {t('add_items_modal.metrics.triangles', { count: draft.metrics.triangles ?? 0 })}
              </S.MetricPill>
              <S.MetricPill>
                <MaterialIcon />
                {t('add_items_modal.metrics.materials', { count: draft.metrics.materials ?? 0 })}
              </S.MetricPill>
              <S.MetricPill>
                <TextureIcon />
                {t('add_items_modal.metrics.textures', { count: draft.metrics.textures ?? 0 })}
              </S.MetricPill>
            </>
          ) : null}
        </S.MetricsRow>
        {isSmart && (
          <>
            <RequiredPermissions permissions={draft.requiredPermissions} testId="draft-permissions" />
            {!draft.contents[VIDEO_PATH] && (
              <S.InfoCard data-testid="smart-video-notice">
                <InfoIcon />
                {t('add_items_modal.smart_video_notice')}
              </S.InfoCard>
            )}
          </>
        )}
        {warnings.length > 0 && (
          <S.WarningsList data-testid="draft-warnings">
            {warnings.map(warning => (
              <S.WarningCard key={warning.key}>
                <WarningIcon />
                {warning.text}
              </S.WarningCard>
            ))}
          </S.WarningsList>
        )}
      </S.PreviewPane>

      <S.FormPane>
        <S.FormHeading>{t('add_items_modal.form_heading')}</S.FormHeading>

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
            <S.Segmented role="radiogroup" aria-label={t('add_items_modal.body_shape')}>
              {BODY_SHAPES.map(({ value, icon }) => {
                const selected = draft.bodyShape === value
                const locked = draft.bodyShapeLocked
                return (
                  <Tooltip
                    key={value}
                    content={locked && !selected && bodyShapeHint ? t(bodyShapeHint) : null}
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
                      onClick={() => {
                        if (locked) return
                        onUpdate(draft.id, {
                          bodyShape: value,
                          // Going back to BOTH clears the variant answer entirely.
                          ...(value === BodyShapeType.BOTH
                            ? { isVariant: false, variantTargetId: null }
                            : { variantTargetId: null })
                        })
                      }}
                    >
                      {icon}
                      {t(`add_items_modal.body_shape_option.${value}`)}
                    </S.SegmentButton>
                  </Tooltip>
                )
              })}
            </S.Segmented>
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
            </S.Field>
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
          </S.FieldRow>
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

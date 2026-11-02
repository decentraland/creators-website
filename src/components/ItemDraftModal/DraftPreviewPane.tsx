import { useMemo, type ReactNode } from 'react'
import {
  CameraAlt as CameraIcon,
  ChangeHistory as TriangleIcon,
  Circle as MaterialIcon,
  ReportProblemOutlined as WarningIcon,
  SentimentSatisfiedAlt as SmileIcon,
  Texture as TextureIcon,
  ThirtyFpsSelect as FpsIcon
} from '@mui/icons-material'
import { ItemThumbnail } from '~/components/ItemThumbnail'
import { ClockIcon, FilmReelIcon, ImageIcon } from '~/components/Icons'
import { RequiredPermissions } from '~/components/RequiredPermissions'
import { Tooltip } from '~/components/Tooltip'
import { useThumbnailValidation } from '~/hooks/useThumbnailValidation'
import { useTranslation } from '~/intl'
import { THUMBNAIL_PATH, hasFacialExpressions } from '~/lib/itemFiles'
import { ItemType } from '~/lib/items'
import { type PreviewDraft } from '~/lib/draftPreview'
import * as S from './ItemDraftModal.styles'

type Props = {
  draft: PreviewDraft
  /** Shows the thumbnail as a plain preview, not an edit control (a variant's target keeps its own). */
  thumbnailLocked?: boolean
  onOpenThumbnail: () => void
  /** Extra controls under the metrics, before the warnings. */
  children?: ReactNode
}

/** The left pane of the item details modals: thumbnail, badges, metrics, permissions and validation warnings. */
export function DraftPreviewPane({ draft, thumbnailLocked = false, onOpenThumbnail, children }: Props) {
  const { t } = useTranslation()
  const isEmote = draft.type === ItemType.EMOTE
  const isWearable = draft.type === ItemType.WEARABLE
  const isSmart = isWearable && draft.isSmart

  const thumbnailBlob = draft.contents[THUMBNAIL_PATH]
  const thumbnailSource = useMemo(
    () => (thumbnailBlob ? ({ kind: 'blob', blob: thumbnailBlob } as const) : null),
    [thumbnailBlob]
  )
  const { data: thumbnailValidation } = useThumbnailValidation(thumbnailSource)
  const warnings = useMemo(
    () =>
      [...draft.validationIssues, ...(thumbnailValidation?.issues ?? [])].map(issue => ({
        key: `${issue.code}-${issue.where ?? ''}-${issue.message}`,
        text: issue.message
      })),
    [draft.validationIssues, thumbnailValidation]
  )

  return (
    <S.PreviewPane data-testid="draft-preview-pane">
      <S.ThumbnailWrap>
        {thumbnailLocked ? (
          <S.ThumbnailBox as="div">
            <ItemThumbnail src={draft.thumbnail} rarity={draft.rarity} testId="draft-thumbnail" />
          </S.ThumbnailBox>
        ) : (
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
        )}
        {isWearable && hasFacialExpressions(draft.contents) && (
          <Tooltip content={t('add_items_modal.facial_expressions')} asChild>
            <S.ThumbnailBadge
              tabIndex={0}
              aria-label={t('add_items_modal.facial_expressions')}
              data-testid="facial-expressions-badge"
            >
              <SmileIcon />
            </S.ThumbnailBadge>
          </Tooltip>
        )}
      </S.ThumbnailWrap>
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
      {isSmart && <RequiredPermissions permissions={draft.requiredPermissions} testId="draft-permissions" />}
      {children}
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
  )
}

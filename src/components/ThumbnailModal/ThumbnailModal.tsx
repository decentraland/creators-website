import { useMemo, useRef, useState } from 'react'
import { PreviewProjection } from '@dcl/schemas'
import { WearablePreview } from 'decentraland-ui2'
import { VerticalPosition } from 'decentraland-ui2/dist/components/WearablePreview/TranslationControls'
import { Position } from 'decentraland-ui2/dist/components/WearablePreview/ZoomControls'
import { Button } from '~/components/Button'
import { Modal } from '~/components/Modal'
import { EmoteControls, TranslationControls, ZoomControls } from '~/components/PreviewControls'
import { useTranslation } from '~/intl'
import { THUMBNAIL_PATH } from '~/lib/itemFiles'
import { ItemType } from '~/lib/items'
import {
  ImageType,
  dataURLToBlob,
  getImageType,
  isPngBackgroundTransparent,
  resizeImage,
  blobToDataURL
} from '~/lib/media'
import { toEmoteWithBlobs, toWearableWithBlobs } from '~/lib/preview'
import * as S from './ThumbnailModal.styles'

const PREVIEW_ID = 'thumbnail-editor'
const THUMBNAIL_SIZE = 1024

export type ThumbnailPatch = {
  /** Data URL of the new thumbnail; also stored as contents[THUMBNAIL_PATH]. */
  thumbnail: string
  contents: Record<string, Blob>
  thumbnailNotTransparent: boolean
  isAutoThumbnail: boolean
}

export class ThumbnailFormatError extends Error {}

export async function thumbnailPatchFromDataURL(
  contents: Record<string, Blob>,
  thumbnail: string
): Promise<ThumbnailPatch> {
  const thumbnailBlob = dataURLToBlob(thumbnail)
  if (!thumbnailBlob) throw new Error('Could not decode the thumbnail')
  return {
    thumbnail,
    contents: { ...contents, [THUMBNAIL_PATH]: thumbnailBlob },
    thumbnailNotTransparent: !(await isPngBackgroundTransparent(thumbnailBlob)),
    isAutoThumbnail: false
  }
}

/** Builds the patch for a user-picked PNG, resized to the thumbnail size. Throws ThumbnailFormatError for non-PNGs. */
export async function thumbnailPatchFromFile(contents: Record<string, Blob>, file: File): Promise<ThumbnailPatch> {
  if ((await getImageType(file)) !== ImageType.PNG) throw new ThumbnailFormatError()
  const resized = await resizeImage(file, THUMBNAIL_SIZE, THUMBNAIL_SIZE)
  return thumbnailPatchFromDataURL(contents, await blobToDataURL(resized))
}

type Props = {
  type: ItemType | null
  /** The item files to render; null while they are still being fetched. */
  contents: Record<string, Blob> | null
  /** Shown in place of the preview when the files could not be fetched. */
  loadError?: boolean
  onSave: (patch: ThumbnailPatch) => void
  onClose: () => void
}

/**
 * Interactive thumbnail editor: pose/zoom the item in a live WearablePreview and capture, or
 * (wearables only) upload a PNG instead. Image-only wearables never reach this modal.
 */
export function ThumbnailModal({ type, contents, loadError = false, onSave, onClose }: Props) {
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isReady, setReady] = useState(false)
  const [isSaving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEmote = type === ItemType.EMOTE
  // A new blob reference remounts the preview iframe, so keep it stable across local state changes.
  const blob = useMemo(
    () => (contents ? (isEmote ? toEmoteWithBlobs(contents) : toWearableWithBlobs(contents)) : null),
    [isEmote, contents]
  )

  function handleCapture() {
    setSaving(true)
    setError(null)
    void (async () => {
      try {
        const controller = WearablePreview.createController(PREVIEW_ID)
        if (isEmote) await controller.emote.pause()
        const screenshot = await controller.scene.getScreenshot(THUMBNAIL_SIZE, THUMBNAIL_SIZE)
        onSave(await thumbnailPatchFromDataURL(contents!, screenshot))
      } catch {
        setError(t('thumbnail_modal.capture_failed'))
        setSaving(false)
      }
    })()
  }

  function handleUpload(files: FileList | null) {
    const file = files?.[0]
    if (!file) return
    setSaving(true)
    setError(null)
    void (async () => {
      try {
        onSave(await thumbnailPatchFromFile(contents!, file))
      } catch (err) {
        setError(
          t(err instanceof ThumbnailFormatError ? 'thumbnail_modal.wrong_format' : 'thumbnail_modal.capture_failed')
        )
        setSaving(false)
      }
    })()
  }

  return (
    <Modal
      title={t('thumbnail_modal.title')}
      onClose={onClose}
      closeDisabled={isSaving}
      size="wide"
      testId="thumbnail-modal"
    >
      <S.Wrap>
        <S.PreviewArea data-testid="thumbnail-preview">
          {!blob && !loadError && <S.Spinner aria-hidden data-testid="thumbnail-loading" />}
          {loadError && (
            <S.LoadError data-testid="thumbnail-load-error">{t('thumbnail_modal.load_failed')}</S.LoadError>
          )}
          {blob && (
            <WearablePreview
              id={PREVIEW_ID}
              blob={blob}
              disableBackground
              disableAutoRotate
              projection={PreviewProjection.PERSPECTIVE}
              zoom={50}
              wheelZoom={2}
              {...(isEmote
                ? {
                    profile: 'default',
                    disableFace: true,
                    disableDefaultWearables: true,
                    disableDefaultEmotes: true,
                    skin: '000000'
                  }
                : {})}
              onLoad={() => setReady(true)}
            />
          )}
          <S.Frame aria-hidden data-testid="thumbnail-frame" />
          {isReady && (
            <>
              <ZoomControls className="zoom-controls" position={Position.RIGHT} wearablePreviewId={PREVIEW_ID} />
              <TranslationControls
                className="translation-controls"
                vertical
                verticalPosition={VerticalPosition.LEFT}
                wearablePreviewId={PREVIEW_ID}
              />
            </>
          )}
        </S.PreviewArea>
        {/* Mount before the preview loads so its PLAY event is delivered at load
            time. Controls subscribed after that miss it and stay stuck until the next play. */}
        {isEmote && (
          <S.EmoteBar data-testid="thumbnail-emote-controls" data-ready={isReady}>
            <EmoteControls className="emote-controls" wearablePreviewId={PREVIEW_ID} />
          </S.EmoteBar>
        )}
        {error && <S.ErrorText data-testid="thumbnail-error">{error}</S.ErrorText>}
        <S.Actions>
          {!isEmote && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png"
                hidden
                data-testid="thumbnail-file-input"
                onChange={event => {
                  handleUpload(event.target.files)
                  event.target.value = ''
                }}
              />
              <Button
                type="button"
                variant="secondary"
                data-testid="thumbnail-upload"
                disabled={isSaving || !contents}
                onClick={() => fileInputRef.current?.click()}
              >
                {t('thumbnail_modal.upload_picture')}
              </Button>
            </>
          )}
          <Button
            type="button"
            variant="primary"
            data-testid="thumbnail-capture"
            disabled={!isReady || isSaving}
            onClick={handleCapture}
          >
            {t('thumbnail_modal.capture')}
          </Button>
        </S.Actions>
      </S.Wrap>
    </Modal>
  )
}

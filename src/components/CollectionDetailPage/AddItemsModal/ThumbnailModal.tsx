import { useRef, useState } from 'react'
import { PreviewProjection } from '@dcl/schemas'
import { WearablePreview } from 'decentraland-ui2'
import { Button } from '~/components/Button'
import { Modal } from '~/components/Modal'
import { EmoteControls, ZoomControls } from '~/components/PreviewControls'
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
import { type ItemDraft } from './AddItemsModal.state'
import * as S from './ThumbnailModal.styles'

const PREVIEW_ID = 'thumbnail-editor'
const THUMBNAIL_SIZE = 1024

export type ThumbnailPatch = Pick<ItemDraft, 'thumbnail' | 'contents' | 'thumbnailNotTransparent'>

export class ThumbnailFormatError extends Error {}

export async function thumbnailPatchFromDataURL(draft: ItemDraft, thumbnail: string): Promise<ThumbnailPatch> {
  const thumbnailBlob = dataURLToBlob(thumbnail)
  if (!thumbnailBlob) throw new Error('Could not decode the thumbnail')
  return {
    thumbnail,
    contents: { ...draft.contents, [THUMBNAIL_PATH]: thumbnailBlob },
    thumbnailNotTransparent: !(await isPngBackgroundTransparent(thumbnailBlob))
  }
}

/** Builds the patch for a user-picked PNG, resized to the thumbnail size. Throws ThumbnailFormatError for non-PNGs. */
export async function thumbnailPatchFromFile(draft: ItemDraft, file: File): Promise<ThumbnailPatch> {
  if ((await getImageType(file)) !== ImageType.PNG) throw new ThumbnailFormatError()
  const resized = await resizeImage(file, THUMBNAIL_SIZE, THUMBNAIL_SIZE)
  return thumbnailPatchFromDataURL(draft, await blobToDataURL(resized))
}

type Props = {
  draft: ItemDraft
  onSave: (patch: ThumbnailPatch) => void
  onClose: () => void
}

/**
 * Interactive thumbnail editor: pose/zoom the item in a live WearablePreview and capture, or
 * (wearables only) upload a PNG instead. Image-only wearables never reach this modal.
 */
export function ThumbnailModal({ draft, onSave, onClose }: Props) {
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isReady, setReady] = useState(false)
  const [isSaving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEmote = draft.type === ItemType.EMOTE
  const blob = isEmote ? toEmoteWithBlobs(draft.contents) : toWearableWithBlobs(draft.contents)

  function handleCapture() {
    setSaving(true)
    setError(null)
    void (async () => {
      try {
        const controller = WearablePreview.createController(PREVIEW_ID)
        if (isEmote) await controller.emote.pause()
        const screenshot = await controller.scene.getScreenshot(THUMBNAIL_SIZE, THUMBNAIL_SIZE)
        onSave(await thumbnailPatchFromDataURL(draft, screenshot))
      } catch {
        setError(t('add_items_modal.thumbnail.capture_failed'))
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
        onSave(await thumbnailPatchFromFile(draft, file))
      } catch (err) {
        setError(
          t(
            err instanceof ThumbnailFormatError
              ? 'add_items_modal.thumbnail.wrong_format'
              : 'add_items_modal.thumbnail.capture_failed'
          )
        )
        setSaving(false)
      }
    })()
  }

  return (
    <Modal
      title={t('add_items_modal.thumbnail.title')}
      onClose={onClose}
      closeDisabled={isSaving}
      size="wide"
      testId="thumbnail-modal"
    >
      <S.Wrap>
        <S.PreviewArea data-testid="thumbnail-preview">
          <WearablePreview
            id={PREVIEW_ID}
            blob={blob}
            disableBackground
            disableAutoRotate
            projection={PreviewProjection.ORTHOGRAPHIC}
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
          {isReady && (
            <>
              <ZoomControls className="zoom-controls" wearablePreviewId={PREVIEW_ID} />
              {isEmote && <EmoteControls className="emote-controls" wearablePreviewId={PREVIEW_ID} />}
            </>
          )}
        </S.PreviewArea>
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
                disabled={isSaving}
                onClick={() => fileInputRef.current?.click()}
              >
                {t('add_items_modal.thumbnail.upload_picture')}
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
            {t('add_items_modal.thumbnail.capture')}
          </Button>
        </S.Actions>
      </S.Wrap>
    </Modal>
  )
}

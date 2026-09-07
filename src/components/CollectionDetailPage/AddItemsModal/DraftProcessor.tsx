import { useEffect, useMemo, useRef } from 'react'
import { PreviewProjection } from '@dcl/schemas'
import { WearablePreview } from 'decentraland-ui2'
import { dataURLToBlob, isPngBackgroundTransparent } from '~/lib/media'
import { THUMBNAIL_PATH } from '~/lib/itemFiles'
import { ItemType, type ItemMetrics } from '~/lib/items'
import { toEmoteWithBlobs, toWearableWithBlobs } from '~/lib/preview'
import { renderPosedThumbnail } from '~/lib/renderPosedThumbnail'
import { getThumbnailPose, isAutoThumbnailStale } from '~/lib/thumbnailPose'
import { type ItemDraft } from './AddItemsModal.state'
import * as S from './AddItemsModal.styles'

const PREVIEW_ID = 'draft-processor'
const THUMBNAIL_SIZE = 1024
// A controller call against a scene being replaced throws ("The scene was disposed, a newer render
// has replaced it"); a few attempts absorb that without hiding a genuinely broken file.
const MAX_ATTEMPTS = 4
const RETRY_DELAY_MS = 750

type Props = {
  draft: ItemDraft
  onResult: (id: string, patch: Partial<ItemDraft>) => void
  onError: (id: string) => void
}

type LoadPhase = 'idle' | 'update-sent' | 'loaded'

/**
 * Off-screen WearablePreview that fills a draft's metrics and auto thumbnail, one draft at a
 * time (the parent passes the next draft that still needs preview data). Categories with a
 * thumbnail pose are rendered offscreen instead of screenshotting the preview, and re-rendered
 * when the category change alters the pose.
 */
export function DraftProcessor({ draft, onResult, onError }: Props) {
  // A controller call can still fail mid-flight when the scene is being replaced, so attempts are
  // retried until one round-trip completes against a live scene.
  const pose = draft.type === ItemType.WEARABLE ? getThumbnailPose(draft.category) : null
  // A pose change on an already-processed draft is a new run against the same iframe.
  const runKey = `${draft.id}:${pose ?? ''}`
  const runRef = useRef({ runKey: '', done: false, busy: false, attempts: 0, retryTimer: 0 })

  if (runRef.current.runKey !== runKey) {
    window.clearTimeout(runRef.current.retryTimer)
    runRef.current = { runKey, done: false, busy: false, attempts: 0, retryTimer: 0 }
  }

  // The iframe is kept across drafts (a remount reboots the whole preview app), so a new draft's
  // model travels as an UPDATE message. Until that message is out, any LOAD still belongs to the
  // previous scene and must not trigger an attempt.
  const loadRef = useRef<{ draftId: string; phase: LoadPhase }>({ draftId: '', phase: 'idle' })
  if (loadRef.current.draftId !== draft.id) {
    loadRef.current = { draftId: draft.id, phase: 'idle' }
  }

  const attempt = () => {
    const run = runRef.current
    if (run.runKey !== runKey || run.done || run.busy) return
    run.busy = true
    run.attempts++

    void (async () => {
      try {
        const controller = WearablePreview.createController(PREVIEW_ID)

        if (draft.type === ItemType.EMOTE) {
          // Screenshot a random frame, like the legacy modal.
          const length = await controller.emote.getLength()
          if (length > 0) {
            await controller.emote.goTo(Math.floor(Math.random() * length))
          }
        }

        const metrics: ItemMetrics =
          draft.type === ItemType.WEARABLE ? await controller.scene.getMetrics() : (draft.metrics ?? {})

        const patch: Partial<ItemDraft> = { metrics }
        if (!draft.thumbnail || isAutoThumbnailStale(draft)) {
          const thumbnail = pose
            ? await renderPosedThumbnail(draft.contents, draft.model, pose).catch((error: unknown) => {
                console.warn('Posed thumbnail render failed, falling back to preview screenshot', error)
                return controller.scene.getScreenshot(THUMBNAIL_SIZE, THUMBNAIL_SIZE)
              })
            : await controller.scene.getScreenshot(THUMBNAIL_SIZE, THUMBNAIL_SIZE)
          const thumbnailBlob = dataURLToBlob(thumbnail)
          patch.thumbnail = thumbnail
          patch.isAutoThumbnail = true
          patch.autoThumbnailCategory = draft.category
          if (thumbnailBlob) {
            patch.contents = { ...draft.contents, [THUMBNAIL_PATH]: thumbnailBlob }
            patch.thumbnailNotTransparent = !(await isPngBackgroundTransparent(thumbnailBlob))
          }
        }

        if (run.runKey !== runKey) return
        run.done = true
        onResult(draft.id, patch)
      } catch (error) {
        run.busy = false
        if (run.runKey !== runKey || run.done) return
        if (run.attempts >= MAX_ATTEMPTS) {
          console.error('Preview processing failed:', error)
          onError(draft.id)
          return
        }
        run.retryTimer = window.setTimeout(attempt, RETRY_DELAY_MS)
      } finally {
        run.busy = false
      }
    })()
  }

  // The iframe's onLoad only fires once per draft: a later pose change has to kick off its run here.
  useEffect(() => {
    if (loadRef.current.phase === 'loaded') attempt()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runKey])

  const isEmote = draft.type === ItemType.EMOTE
  // Rewrapping the same contents each render would reload the iframe endlessly.
  const blob = useMemo(
    () => (isEmote ? toEmoteWithBlobs(draft.contents, draft.id) : toWearableWithBlobs(draft.contents, draft.id)),
    [isEmote, draft.contents, draft.id]
  )

  return (
    <S.HiddenPreview aria-hidden data-testid="draft-processor">
      {/* Emote-only options are URL params, so a type switch is the one case that needs a fresh iframe. */}
      <WearablePreview
        key={isEmote ? 'emote' : 'wearable'}
        id={PREVIEW_ID}
        blob={blob}
        disableBackground
        disableAutoRotate
        projection={PreviewProjection.ORTHOGRAPHIC}
        {...(isEmote ? { profile: 'default', disableFace: true, disableDefaultWearables: true, skin: '000000' } : {})}
        onUpdate={() => {
          if (loadRef.current.phase === 'idle') loadRef.current.phase = 'update-sent'
        }}
        onLoad={() => {
          if (loadRef.current.phase === 'idle') return
          loadRef.current.phase = 'loaded'
          attempt()
        }}
        onError={() => {
          // Iframe-level errors also count as attempts so a broken preview can't hang forever.
          const run = runRef.current
          if (run.runKey !== runKey || run.done || run.busy) return
          run.attempts++
          if (run.attempts >= MAX_ATTEMPTS) {
            onError(draft.id)
          } else {
            window.clearTimeout(run.retryTimer)
            run.retryTimer = window.setTimeout(attempt, RETRY_DELAY_MS)
          }
        }}
      />
    </S.HiddenPreview>
  )
}

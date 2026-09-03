import { useMemo, useRef } from 'react'
import { PreviewProjection } from '@dcl/schemas'
import { WearablePreview } from 'decentraland-ui2'
import { dataURLToBlob, isPngBackgroundTransparent } from '~/lib/media'
import { THUMBNAIL_PATH } from '~/lib/itemFiles'
import { ItemType, type ItemMetrics } from '~/lib/items'
import { toEmoteWithBlobs, toWearableWithBlobs } from '~/lib/preview'
import { type ItemDraft } from './AddItemsModal.state'
import * as S from './AddItemsModal.styles'

const PREVIEW_ID = 'draft-processor'
const THUMBNAIL_SIZE = 1024
// The iframe renders a model up to twice ("The scene was disposed, a newer render has replaced
// it"); a couple of extra attempts absorb slow reloads without hiding a genuinely broken file.
const MAX_ATTEMPTS = 4
const RETRY_DELAY_MS = 750

type Props = {
  draft: ItemDraft
  onResult: (id: string, patch: Partial<ItemDraft>) => void
  onError: (id: string) => void
}

/**
 * Off-screen WearablePreview that fills a draft's metrics and auto thumbnail, one draft at a
 * time (the parent passes the next draft that still needs preview data).
 */
export function DraftProcessor({ draft, onResult, onError }: Props) {
  // The preview loads each model twice and disposes the first scene, so a controller call made
  // after the first onLoad can fail mid-flight. Attempts are retried (also re-triggered by the
  // second onLoad) until one round-trip completes against a live scene.
  const runRef = useRef({ draftId: '', done: false, busy: false, attempts: 0, retryTimer: 0 })

  if (runRef.current.draftId !== draft.id) {
    window.clearTimeout(runRef.current.retryTimer)
    runRef.current = { draftId: draft.id, done: false, busy: false, attempts: 0, retryTimer: 0 }
  }

  const attempt = () => {
    const run = runRef.current
    if (run.draftId !== draft.id || run.done || run.busy) return
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
        if (!draft.thumbnail) {
          const thumbnail = await controller.scene.getScreenshot(THUMBNAIL_SIZE, THUMBNAIL_SIZE)
          const thumbnailBlob = dataURLToBlob(thumbnail)
          patch.thumbnail = thumbnail
          if (thumbnailBlob) {
            patch.contents = { ...draft.contents, [THUMBNAIL_PATH]: thumbnailBlob }
            patch.thumbnailNotTransparent = !(await isPngBackgroundTransparent(thumbnailBlob))
          }
        }

        if (run.draftId !== draft.id) return
        run.done = true
        onResult(draft.id, patch)
      } catch (error) {
        run.busy = false
        if (run.draftId !== draft.id || run.done) return
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

  const isEmote = draft.type === ItemType.EMOTE
  // Rewrapping the same contents each render would reload the iframe endlessly.
  const blob = useMemo(
    () => (isEmote ? toEmoteWithBlobs(draft.contents) : toWearableWithBlobs(draft.contents)),
    [isEmote, draft.contents]
  )

  return (
    <S.HiddenPreview aria-hidden data-testid="draft-processor">
      <WearablePreview
        key={draft.id}
        id={PREVIEW_ID}
        blob={blob}
        disableBackground
        disableAutoRotate
        projection={PreviewProjection.ORTHOGRAPHIC}
        {...(isEmote ? { profile: 'default', disableFace: true, disableDefaultWearables: true, skin: '000000' } : {})}
        onLoad={attempt}
        onError={() => {
          // Iframe-level errors also count as attempts so a broken preview can't hang forever.
          const run = runRef.current
          if (run.draftId !== draft.id || run.done || run.busy) return
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

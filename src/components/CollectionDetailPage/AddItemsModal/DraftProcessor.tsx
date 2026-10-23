import { useEffect, useMemo, useRef } from 'react'
import { PreviewProjection } from '@dcl/schemas'
import { WearablePreview } from 'decentraland-ui2'
import { dataURLToBlob } from '~/lib/media'
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
// A preview that never answers would otherwise hold the whole queue: drafts are processed one at a time.
// Counted from the moment the run can start (the model's UPDATE, or a pose change on a loaded iframe), so a
// cold boot of the preview app doesn't eat into it.
const PROCESSING_TIMEOUT_MS = 30_000

type Props = {
  draft: ItemDraft
  onResult: (id: string, patch: Partial<ItemDraft>) => void
  onError: (id: string) => void
}

type LoadPhase = 'idle' | 'update-sent' | 'loaded'

type Run = {
  runKey: string
  done: boolean
  busy: boolean
  /** A LOAD that arrived during a read in flight; the read runs again when it ends. */
  loadPending: boolean
  attempts: number
  retryTimer: number
  watchdog: number
}

function createRun(runKey: string): Run {
  return { runKey, done: false, busy: false, loadPending: false, attempts: 0, retryTimer: 0, watchdog: 0 }
}

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
  const runRef = useRef<Run>(createRun(''))

  if (runRef.current.runKey !== runKey) {
    window.clearTimeout(runRef.current.retryTimer)
    window.clearTimeout(runRef.current.watchdog)
    runRef.current = createRun(runKey)
  }

  // The iframe is kept across drafts (a remount reboots the whole preview app), so a new draft's
  // model travels as an UPDATE message. Until that message is out, any LOAD still belongs to the
  // previous scene and must not trigger an attempt.
  const loadRef = useRef<{ draftId: string; phase: LoadPhase }>({ draftId: '', phase: 'idle' })
  if (loadRef.current.draftId !== draft.id) {
    loadRef.current = { draftId: draft.id, phase: 'idle' }
  }

  const armWatchdog = (run: Run) => {
    window.clearTimeout(run.watchdog)
    run.watchdog = window.setTimeout(() => {
      if (run.done) return
      run.done = true
      // A re-render for a new pose that hangs keeps the metrics and thumbnail the draft already has.
      if (draft.metrics) onResult(draft.id, { autoThumbnailCategory: draft.category })
      else onError(draft.id)
    }, PROCESSING_TIMEOUT_MS)
  }

  const attempt = () => {
    const run = runRef.current
    if (run.done || run.busy) return
    run.busy = true

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
        // The iframe also announces its initial, model-less render, and that LOAD can land after the UPDATE
        // was sent: metrics read against that empty scene are all zeros. Not a failure, the model just isn't
        // in yet; the real render's own LOAD starts the next read.
        if (draft.type === ItemType.WEARABLE && !metrics.meshes) return

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
          if (thumbnailBlob) patch.contents = { ...draft.contents, [THUMBNAIL_PATH]: thumbnailBlob }
        }

        if (runRef.current !== run || run.done) return
        run.done = true
        onResult(draft.id, patch)
      } catch (error) {
        if (runRef.current !== run || run.done) return
        run.attempts++
        if (run.attempts >= MAX_ATTEMPTS) {
          console.error('Preview processing failed:', error)
          run.done = true
          onError(draft.id)
          return
        }
        run.retryTimer = window.setTimeout(attempt, RETRY_DELAY_MS)
      } finally {
        run.busy = false
        if (run.loadPending) {
          run.loadPending = false
          attempt()
        }
      }
    })()
  }

  // A pose change on an already-loaded iframe produces no LOAD, so its run starts here.
  useEffect(() => {
    const run = runRef.current
    if (loadRef.current.phase === 'loaded') {
      armWatchdog(run)
      attempt()
    }
    return () => {
      window.clearTimeout(run.watchdog)
      window.clearTimeout(run.retryTimer)
    }
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
          if (loadRef.current.phase !== 'idle') return
          loadRef.current.phase = 'update-sent'
          armWatchdog(runRef.current)
        }}
        onLoad={() => {
          if (loadRef.current.phase === 'idle') return
          loadRef.current.phase = 'loaded'
          if (runRef.current.busy) runRef.current.loadPending = true
          else attempt()
        }}
        onError={() => {
          // Iframe-level errors also count as attempts so a broken preview can't hang forever.
          const run = runRef.current
          if (run.done || run.busy) return
          run.attempts++
          if (run.attempts >= MAX_ATTEMPTS) {
            run.done = true
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

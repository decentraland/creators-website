import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  PreviewEmote,
  PreviewEmoteEventType,
  PreviewUnityMode,
  type IPreviewController,
  type PreviewRenderer
} from '@dcl/schemas'
import { Env } from '@dcl/ui-env'
import { WearablePreview } from 'decentraland-ui2'
import { config } from '~/config'
import { type AvatarAttributes } from '~/lib/avatar'
import {
  PREVIEW_WHEEL_START,
  PREVIEW_WHEEL_ZOOM,
  buildPreviewOptions,
  getPreviewZoom,
  isEmoteSubject,
  type AvatarPreviewSource
} from '~/lib/preview'
import { createPreviewBridge, type PreviewBridge } from '~/lib/previewBridge'
import { useAvatarPreview } from '~/store/avatarPreview'
import * as S from './AvatarPreview.styles'

export type { AvatarPreviewSource }

type Props = {
  id: string
  source: AvatarPreviewSource
  avatar: AvatarAttributes
  /** Ignored while an emote item is the subject: the item owns the animation then. */
  emote?: PreviewEmote
  /** Renderer request; the caller decides through `lib/pickRenderer`. */
  unity?: boolean
  onLoad?: (renderer?: PreviewRenderer) => void
  onError?: (error: Error) => void
  onController?: (controller: IPreviewController) => void
  /** Overlay slot along the bottom (playback, customizer, badges). */
  children?: ReactNode
  testId?: string
}

/**
 * The shared avatar preview. Mounts ui2's WearablePreview once with a frozen snapshot of the
 * URL-bound options and pushes every later change through `lib/previewBridge`, so avatar and item
 * changes never reload the iframe.
 */
export function AvatarPreview({
  id,
  source,
  avatar,
  emote = PreviewEmote.IDLE,
  unity = false,
  onLoad,
  onError,
  onController,
  children,
  testId = 'avatar-preview'
}: Props) {
  const [snapshot] = useState(() => ({ ...avatar, emote, unity, emoteSubject: isEmoteSubject(source) }))
  const [isLoading, setLoading] = useState(true)
  const bridgeRef = useRef<PreviewBridge | null>(null)
  const options = useMemo(() => buildPreviewOptions(source, avatar, emote), [source, avatar, emote])
  const optionsRef = useRef(options)
  optionsRef.current = options
  const onLoadRef = useRef(onLoad)
  onLoadRef.current = onLoad
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError
  const onControllerRef = useRef(onController)
  onControllerRef.current = onController

  // The iframe exists once ui2 has committed; the bridge and the controller attach to it by id.
  useEffect(() => {
    const iframe = document.getElementById(id)
    if (!(iframe instanceof HTMLIFrameElement)) return
    // The iframe app draws its own loader once it has booted (READY); ours only covers the blank gap before that.
    const bridge = createPreviewBridge({ iframe, onBoot: () => setLoading(false) })
    bridgeRef.current = bridge
    bridge.update(optionsRef.current)

    // Created at mount, not in onLoad: Babylon fires PLAY right after LOAD and a late subscriber misses it.
    const controller = WearablePreview.createController(id)
    const { setPlaying, endEmote } = useAvatarPreview.getState()
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onEnd = () => endEmote()
    controller.emote.events.on(PreviewEmoteEventType.ANIMATION_PLAY, onPlay)
    controller.emote.events.on(PreviewEmoteEventType.ANIMATION_PAUSE, onPause)
    controller.emote.events.on(PreviewEmoteEventType.ANIMATION_END, onEnd)
    onControllerRef.current?.(controller)

    return () => {
      bridge.dispose()
      bridgeRef.current = null
      controller.emote.events.off(PreviewEmoteEventType.ANIMATION_PLAY, onPlay)
      controller.emote.events.off(PreviewEmoteEventType.ANIMATION_PAUSE, onPause)
      controller.emote.events.off(PreviewEmoteEventType.ANIMATION_END, onEnd)
      setPlaying(false)
    }
  }, [id])

  useEffect(() => {
    bridgeRef.current?.update(options)
  }, [options])

  return (
    <S.Wrap data-testid={testId} data-loading={isLoading || undefined}>
      <WearablePreview
        id={id}
        profile="default"
        bodyShape={snapshot.bodyShape}
        skin={snapshot.skin}
        eyes={snapshot.eyes}
        hair={snapshot.hair}
        urns={snapshot.baseWearableUrns}
        emote={snapshot.emoteSubject ? undefined : snapshot.emote}
        disableDefaultEmotes={snapshot.emoteSubject || undefined}
        disableAutoRotate
        disableBackground
        zoom={getPreviewZoom(snapshot.emoteSubject ? undefined : snapshot.emote)}
        wheelZoom={PREVIEW_WHEEL_ZOOM}
        wheelStart={PREVIEW_WHEEL_START}
        unity={snapshot.unity}
        unityMode={PreviewUnityMode.BUILDER}
        dev={config.is(Env.DEVELOPMENT)}
        onLoad={renderer => {
          setLoading(false)
          onLoadRef.current?.(renderer)
        }}
        onError={error => {
          setLoading(false)
          onErrorRef.current?.(error)
        }}
      />
      {isLoading && (
        <S.Loader aria-busy="true" data-testid={`${testId}-loading`}>
          <span className="spinner" aria-hidden />
        </S.Loader>
      )}
      {children && (
        <S.Overlay data-testid={`${testId}-overlay`} data-emote-subject={isEmoteSubject(source) || undefined}>
          {children}
        </S.Overlay>
      )}
    </S.Wrap>
  )
}

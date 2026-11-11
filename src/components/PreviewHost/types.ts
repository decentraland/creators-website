import type {
  BodyShape,
  EmoteWithBlobs,
  IPreviewController,
  PreviewEmote,
  PreviewProjection,
  PreviewRenderer,
  PreviewUnityMode,
  WearableWithBlobs
} from '@dcl/schemas'

/** The part of the wearable-preview controller protocol the app calls; another host has to answer exactly these. */
export type PreviewController = {
  emote: Pick<
    IPreviewController['emote'],
    'events' | 'getLength' | 'goTo' | 'play' | 'pause' | 'stop' | 'hasSound' | 'enableSound' | 'disableSound'
  >
  scene: Pick<IPreviewController['scene'], 'getScreenshot' | 'getMetrics' | 'changeZoom'>
  physics: Pick<IPreviewController['physics'], 'setSpringBonesParams'>
}

/**
 * Options the host bakes into the preview at mount. It renders an iframe with `id` that speaks the
 * wearable-preview postMessage protocol, so `lib/previewBridge` and `createPreviewController` can reach it.
 */
export type PreviewHostProps = {
  id: string
  blob?: WearableWithBlobs | EmoteWithBlobs
  profile?: string
  bodyShape?: BodyShape
  skin?: string
  eyes?: string
  hair?: string
  urns?: string[]
  emote?: PreviewEmote
  projection?: PreviewProjection
  zoom?: number
  wheelZoom?: number
  wheelStart?: number
  disableBackground?: boolean
  disableAutoRotate?: boolean
  disableFace?: boolean
  disableDefaultWearables?: boolean
  disableDefaultEmotes?: boolean
  unity?: boolean
  unityMode?: PreviewUnityMode
  dev?: boolean
  onLoad?: (renderer?: PreviewRenderer) => void
  onError?: (error: Error) => void
  /** Fired when the host sends the iframe new options. */
  onUpdate?: () => void
}

type ControlsProps = {
  previewId: string
  /** Share the page's controller: a second one drops the requests the first has in flight. */
  controller?: PreviewController
  className?: string
}

export type EmoteControlsProps = ControlsProps & {
  hideFrameInput?: boolean
  hideSoundButton?: boolean
}

export type TranslationControlsProps = ControlsProps & {
  vertical?: boolean
  verticalPosition?: 'left' | 'right'
}

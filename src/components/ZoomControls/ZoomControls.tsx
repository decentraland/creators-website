import { type IPreviewController } from '@dcl/schemas'
import { Add as ZoomInIcon, Remove as ZoomOutIcon } from '@mui/icons-material'
import { useTranslation } from '~/intl'
import * as S from './ZoomControls.styles'

/**
 * Inertial camera-radius nudge per click. Babylon's inertia (0.9) carries it ~10× further, so this moves
 * the camera ~0.25 units: about five clicks from the start framing to either end of the range.
 */
export const ZOOM_STEP = 0.075

type Props = {
  controller: IPreviewController
  /** Layout-only override (offsets); the look is fixed. */
  className?: string
  testId?: string
}

/**
 * Zoom in / out over a Babylon preview (`scene.changeZoom` is a relative camera nudge there). Unity
 * only reads a zoom level when it frames the camera at load and draws its own buttons in the canvas,
 * so callers must not mount these for it.
 */
export function ZoomControls({ controller, className, testId = 'zoom-controls' }: Props) {
  const { t } = useTranslation()
  const step = (delta: number) => controller.scene.changeZoom(delta).catch(() => undefined)
  return (
    <S.Wrap className={className} data-testid={testId}>
      <S.ZoomButton
        type="button"
        aria-label={t('zoom_controls.in')}
        data-testid={`${testId}-in`}
        onClick={() => void step(ZOOM_STEP)}
      >
        <ZoomInIcon fontSize="small" />
      </S.ZoomButton>
      <S.ZoomButton
        type="button"
        aria-label={t('zoom_controls.out')}
        data-testid={`${testId}-out`}
        onClick={() => void step(-ZOOM_STEP)}
      >
        <ZoomOutIcon fontSize="small" />
      </S.ZoomButton>
    </S.Wrap>
  )
}

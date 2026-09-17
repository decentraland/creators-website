import { type IPreviewController } from '@dcl/schemas'
import { Add as ZoomInIcon, Remove as ZoomOutIcon } from '@mui/icons-material'
import { useTranslation } from '~/intl'
import * as S from './ZoomControls.styles'

/** Camera-radius nudge per click; ui2's 0.1 default is barely visible. */
export const ZOOM_STEP = 2

type Props = {
  controller: IPreviewController
  testId?: string
}

/**
 * Zoom in / out over a Babylon preview (`scene.changeZoom` is a relative camera nudge there). Unity
 * only reads a zoom level when it frames the camera at load and draws its own buttons in the canvas,
 * so the editor does not mount these for it.
 */
export function ZoomControls({ controller, testId = 'zoom-controls' }: Props) {
  const { t } = useTranslation()
  const step = (delta: number) => controller.scene.changeZoom(delta).catch(() => undefined)
  return (
    <S.Wrap data-testid={testId}>
      <S.ZoomButton
        type="button"
        aria-label={t('item_editor.zoom.in')}
        data-testid={`${testId}-in`}
        onClick={() => void step(ZOOM_STEP)}
      >
        <ZoomInIcon fontSize="small" />
      </S.ZoomButton>
      <S.ZoomButton
        type="button"
        aria-label={t('item_editor.zoom.out')}
        data-testid={`${testId}-out`}
        onClick={() => void step(-ZOOM_STEP)}
      >
        <ZoomOutIcon fontSize="small" />
      </S.ZoomButton>
    </S.Wrap>
  )
}

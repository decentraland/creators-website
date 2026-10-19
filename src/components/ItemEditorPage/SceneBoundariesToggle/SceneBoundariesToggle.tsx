import { CylinderIcon } from '~/components/Icons'
import { Tooltip } from '~/components/Tooltip'
import { useTranslation } from '~/intl'
import { track } from '~/lib/analytics'
import { useAvatarPreview } from '~/store/avatarPreview'
import * as S from './SceneBoundariesToggle.styles'

type Props = {
  testId?: string
}

/** Shows or hides the scene boundaries (the cylinder an item has to fit in) around the avatar. */
export function SceneBoundariesToggle({ testId = 'scene-boundaries-toggle' }: Props) {
  const { t } = useTranslation()
  const visible = useAvatarPreview(state => state.showSceneBoundaries)
  const toggle = useAvatarPreview(state => state.toggleSceneBoundaries)
  const label = t(visible ? 'item_editor.scene_boundaries.hide' : 'item_editor.scene_boundaries.show')

  function onClick() {
    track('Toggle scene boundaries', { visible: !visible })
    toggle()
  }

  return (
    <Tooltip content={label} asChild testId={`${testId}-tooltip`}>
      <S.Button
        type="button"
        aria-label={label}
        aria-pressed={visible}
        data-active={visible || undefined}
        data-testid={testId}
        onClick={onClick}
      >
        <CylinderIcon />
      </S.Button>
    </Tooltip>
  )
}

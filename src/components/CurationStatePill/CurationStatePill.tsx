import { useTranslation } from '~/intl'
import { type CurationState } from '~/lib/curation'
import * as S from './CurationStatePill.styles'

export function CurationStatePill({ state }: { state: CurationState }) {
  const { t } = useTranslation()
  return (
    <S.Pill data-testid="curation-state" data-state={state}>
      {t(`curation_state.${state}`)}
    </S.Pill>
  )
}

import { useTranslation } from '~/intl'
import { type ReviewStage } from '~/lib/curation'
import * as S from './ReviewStagePill.styles'

/** The derived review stage (validator, curator, appeal), where the legacy curation pill is not specific enough. */
export function ReviewStagePill({ stage }: { stage: ReviewStage }) {
  const { t } = useTranslation()
  return (
    <S.Pill data-testid="review-stage" data-stage={stage}>
      {t(`review_stage.${stage}`)}
    </S.Pill>
  )
}

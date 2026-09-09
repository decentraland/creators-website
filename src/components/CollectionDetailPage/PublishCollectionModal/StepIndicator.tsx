import { useTranslation } from '~/intl'
import * as S from './PublishCollectionModal.styles'

type Props = {
  /** 1-based current step. */
  current: number
  total: number
}

export function StepIndicator({ current, total }: Props) {
  const { t } = useTranslation()
  return (
    <S.Steps
      aria-label={t('publish_collection_modal.step_label', { step: current, total })}
      data-testid="publish-steps"
    >
      {Array.from({ length: total }, (_, index) => {
        const step = index + 1
        const state = step < current ? 'done' : step === current ? 'current' : 'todo'
        return (
          <S.StepNode
            key={step}
            data-reached={step < current || undefined}
            aria-current={step === current || undefined}
          >
            <S.StepDot data-state={state} data-testid={`publish-step-${step}`}>
              {step}
            </S.StepDot>
          </S.StepNode>
        )
      })}
    </S.Steps>
  )
}

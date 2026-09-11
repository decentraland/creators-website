import { useTranslation } from '~/intl'
import * as S from './StepIndicator.styles'

type Props = {
  /** 1-based current step. */
  current: number
  total: number
  /** One caption per step, shown under its dot. */
  labels?: string[]
  testId?: string
}

/** Numbered dots joined by a line; done steps and the line up to the current one paint red. */
export function StepIndicator({ current, total, labels, testId = 'steps' }: Props) {
  const { t } = useTranslation()
  return (
    <S.Steps
      aria-label={t('step_indicator.label', { step: current, total })}
      data-labelled={labels ? '' : undefined}
      data-testid={testId}
    >
      {Array.from({ length: total }, (_, index) => {
        const step = index + 1
        const state = step < current ? 'done' : step === current ? 'current' : 'todo'
        const align = index === 0 ? 'start' : index === total - 1 ? 'end' : 'center'
        return (
          <S.StepNode
            key={step}
            data-reached={step < current || undefined}
            aria-current={step === current || undefined}
          >
            <S.StepDot data-state={state} data-testid={`${testId}-${step}`}>
              {step}
            </S.StepDot>
            {labels?.[index] && <S.StepLabel data-align={align}>{labels[index]}</S.StepLabel>}
          </S.StepNode>
        )
      })}
    </S.Steps>
  )
}

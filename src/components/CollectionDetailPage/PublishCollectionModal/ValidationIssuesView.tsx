import { useMemo } from 'react'
import {
  ChevronRight as ChevronRightIcon,
  ErrorOutline as WarningIcon,
  ReportProblemOutlined as ErrorIcon
} from '@mui/icons-material'
import { useTranslation } from '~/intl'
import { getContentsStorageUrl } from '~/lib/builder'
import { type Item } from '~/lib/items'
import { hasErrors as anyErrors, type ValidationIssue } from '~/lib/validation'
import { Button } from '~/components/Button'
import { Modal } from '~/components/Modal'
import { ItemValidationCard } from '~/components/ValidationBadge'
import * as S from './ValidationIssuesView.styles'

export type ItemCheck = { item: Item; issues: ValidationIssue[] }

type Props = {
  checks: ItemCheck[]
  blockOnErrors: boolean
  onRerun: (check: ItemCheck) => Promise<unknown>
  onBack: () => void
  onContinue: () => void
}

/** The items whose checks found something, before the publish wizard; copy and footer follow the current results. */
export function ValidationIssuesView({ checks, blockOnErrors, onRerun, onBack, onContinue }: Props) {
  const { t } = useTranslation()
  const hasErrors = useMemo(() => checks.some(check => anyErrors(check.issues)), [checks])
  const variant = hasErrors ? (blockOnErrors ? 'errors_blocking' : 'errors') : 'warnings'
  const canContinue = variant !== 'errors_blocking'

  return (
    <Modal
      title={t(`item_validation.issues.${variant}.title`)}
      size="large"
      hideTitle
      showClose
      onClose={onBack}
      testId="publish-validation-issues"
    >
      <S.Content data-variant={variant} data-testid="publish-validation-issues-content">
        <S.Header>
          <S.HeaderIcon data-variant={hasErrors ? 'errors' : 'warnings'} aria-hidden>
            {hasErrors ? <ErrorIcon /> : <WarningIcon />}
          </S.HeaderIcon>
          <S.Title data-testid="publish-validation-issues-title">
            {t(`item_validation.issues.${variant}.title`)}
          </S.Title>
        </S.Header>
        <S.Intro>{t(`item_validation.issues.${variant}.intro`)}</S.Intro>
        <S.List>
          {checks.map(check => {
            const thumbnailHash = check.item.contents[check.item.thumbnail]
            return (
              <ItemValidationCard
                key={check.item.id}
                subject={{
                  name: check.item.name,
                  type: check.item.type,
                  category: check.item.data.category,
                  thumbnail: thumbnailHash ? getContentsStorageUrl(thumbnailHash) : null
                }}
                issues={check.issues}
                onRerun={() => onRerun(check)}
                testId={`publish-validation-${check.item.id}`}
              />
            )
          })}
        </S.List>
        <S.Footer data-single={canContinue ? undefined : ''}>
          <Button
            type="button"
            variant={canContinue ? 'secondary' : 'primary'}
            data-testid="publish-validation-back"
            onClick={onBack}
          >
            {t('item_validation.issues.back')}
          </Button>
          {canContinue && (
            <Button type="button" variant="primary" data-testid="publish-validation-continue" onClick={onContinue}>
              {t('item_validation.issues.continue')}
              <ChevronRightIcon />
            </Button>
          )}
        </S.Footer>
      </S.Content>
    </Modal>
  )
}

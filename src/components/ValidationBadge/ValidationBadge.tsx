import { useState } from 'react'
import {
  CheckCircleOutline as PassIcon,
  ErrorOutline as WarningIcon,
  ReportProblemOutlined as ErrorIcon
} from '@mui/icons-material'
import { Tooltip } from '~/components/Tooltip'
import { useTranslation } from '~/intl'
import { type ValidationIssue, type ValidationStatus } from '~/lib/validation'
import { type ValidationSubject } from './ItemValidationCard'
import { ValidationResultsModal, type ItemResult } from './ValidationResultsModal'
import * as S from './ValidationBadge.styles'

type Props = {
  status: ValidationStatus
  issues: ValidationIssue[]
  subject?: ValidationSubject
  /** Several items' results, listed in the modal instead of `subject`'s. */
  results?: ItemResult[]
  /** Where the tooltip copy lives, per status. */
  tooltipKey?: string
  onRerun?: () => Promise<unknown>
  /** Called when the results open, e.g. for analytics. */
  onOpen?: () => void
  testId?: string
}

/** Traffic light for the selected item's checks; opens the issue list when there is one. */
export function ValidationBadge({
  status,
  issues,
  subject,
  results,
  tooltipKey = 'item_editor.validation',
  onRerun,
  onOpen,
  testId = 'validation-badge'
}: Props) {
  const { t } = useTranslation()
  const [isOpen, setOpen] = useState(false)
  if (status === 'idle') return null
  const hasIssues = issues.length > 0
  return (
    <>
      <Tooltip content={t(`${tooltipKey}.${status}`)} asChild testId={`${testId}-tooltip`}>
        <S.Badge
          type="button"
          data-status={status}
          data-testid={testId}
          aria-label={t(`${tooltipKey}.${status}`)}
          disabled={!hasIssues}
          onClick={() => {
            if (!hasIssues) return
            setOpen(true)
            onOpen?.()
          }}
        >
          {status === 'loading' && <S.Spinner aria-hidden />}
          {status === 'pass' && <PassIcon fontSize="small" />}
          {status === 'warnings' && <WarningIcon fontSize="small" />}
          {status === 'errors' && <ErrorIcon fontSize="small" />}
          {t(`item_editor.validation.label.${status}`, { count: issues.length })}
        </S.Badge>
      </Tooltip>
      {isOpen && (
        <ValidationResultsModal
          subject={subject}
          issues={issues}
          results={results?.map(result =>
            result.onSelect
              ? {
                  ...result,
                  onSelect: () => {
                    setOpen(false)
                    result.onSelect?.()
                  }
                }
              : result
          )}
          onRerun={onRerun}
          onClose={() => setOpen(false)}
          testId={testId}
        />
      )}
    </>
  )
}

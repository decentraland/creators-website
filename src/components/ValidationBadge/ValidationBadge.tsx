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
import { ValidationResultsModal } from './ValidationResultsModal'
import * as S from './ValidationBadge.styles'

type Props = {
  status: ValidationStatus
  issues: ValidationIssue[]
  subject?: ValidationSubject
  onRerun?: () => Promise<unknown>
  /** Called when the results open, e.g. for analytics. */
  onOpen?: () => void
  testId?: string
}

/** Traffic light for the selected item's checks; opens the issue list when there is one. */
export function ValidationBadge({ status, issues, subject, onRerun, onOpen, testId = 'validation-badge' }: Props) {
  const { t } = useTranslation()
  const [isOpen, setOpen] = useState(false)
  if (status === 'idle') return null
  const hasIssues = issues.length > 0
  return (
    <>
      <Tooltip content={t(`item_editor.validation.${status}`)} asChild testId={`${testId}-tooltip`}>
        <S.Badge
          type="button"
          data-status={status}
          data-testid={testId}
          aria-label={t(`item_editor.validation.${status}`)}
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
          onRerun={onRerun}
          onClose={() => setOpen(false)}
          testId={testId}
        />
      )}
    </>
  )
}

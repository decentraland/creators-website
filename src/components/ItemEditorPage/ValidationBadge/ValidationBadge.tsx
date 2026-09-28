import { useState } from 'react'
import {
  CheckCircleOutline as PassIcon,
  ErrorOutline as ErrorIcon,
  ReportProblemOutlined as WarningIcon
} from '@mui/icons-material'
import { Modal } from '~/components/Modal'
import { Tooltip } from '~/components/Tooltip'
import { useTranslation } from '~/intl'
import { ValidationSeverity, type ValidationIssue } from '~/lib/validation'
import * as S from './ValidationBadge.styles'

export type ValidationStatus = 'idle' | 'loading' | 'pass' | 'warnings' | 'errors'

type Props = {
  status: ValidationStatus
  issues: ValidationIssue[]
  testId?: string
}

export function getValidationStatus(issues: ValidationIssue[] | undefined, isLoading: boolean): ValidationStatus {
  if (isLoading) return 'loading'
  if (!issues) return 'idle'
  if (issues.some(issue => issue.severity === ValidationSeverity.ERROR)) return 'errors'
  return issues.length > 0 ? 'warnings' : 'pass'
}

/** Traffic light for the selected item's model checks; opens the issue list when there is one. */
export function ValidationBadge({ status, issues, testId = 'validation-badge' }: Props) {
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
          onClick={() => hasIssues && setOpen(true)}
        >
          {status === 'loading' && <S.Spinner aria-hidden />}
          {status === 'pass' && <PassIcon fontSize="small" />}
          {status === 'warnings' && <WarningIcon fontSize="small" />}
          {status === 'errors' && <ErrorIcon fontSize="small" />}
          {t(`item_editor.validation.label.${status}`, { count: issues.length })}
        </S.Badge>
      </Tooltip>
      {isOpen && (
        <Modal
          title={t('item_editor.validation.modal_title')}
          onClose={() => setOpen(false)}
          testId={`${testId}-modal`}
        >
          {hasIssues ? (
            <S.IssueList data-testid={`${testId}-issues`}>
              {issues.map(issue => (
                <S.Issue key={`${issue.code}-${issue.messageKey}`} data-severity={issue.severity}>
                  {issue.severity === ValidationSeverity.ERROR ? <ErrorIcon /> : <WarningIcon />}
                  {t(issue.messageKey, issue.messageParams)}
                </S.Issue>
              ))}
            </S.IssueList>
          ) : (
            <S.Empty>{t('item_editor.validation.pass')}</S.Empty>
          )}
        </Modal>
      )}
    </>
  )
}

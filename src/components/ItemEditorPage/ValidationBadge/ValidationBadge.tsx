import { useState } from 'react'
import {
  CheckCircleOutline as PassIcon,
  ErrorOutline as WarningIcon,
  ReportProblemOutlined as ErrorIcon
} from '@mui/icons-material'
import { Modal } from '~/components/Modal'
import { type ItemType } from '~/lib/items'
import { Tooltip } from '~/components/Tooltip'
import { useTranslation } from '~/intl'
import { ValidationSeverity, type ValidationIssue } from '~/lib/validation'
import * as S from './ValidationBadge.styles'

export type ValidationStatus = 'idle' | 'loading' | 'pass' | 'warnings' | 'errors'

/** The item the results are about, shown above them. */
export type ValidationSubject = {
  name: string
  type: ItemType
  category?: string
  /** Omitted (not null) when there is no artwork tile at all, e.g. a live preview. */
  thumbnail?: string | null
}

type Props = {
  status: ValidationStatus
  issues: ValidationIssue[]
  subject?: ValidationSubject
  testId?: string
}

export function getValidationStatus(issues: ValidationIssue[] | undefined, isLoading: boolean): ValidationStatus {
  if (isLoading) return 'loading'
  if (!issues) return 'idle'
  if (issues.some(issue => issue.severity === ValidationSeverity.ERROR)) return 'errors'
  return issues.length > 0 ? 'warnings' : 'pass'
}

/** Traffic light for the selected item's checks; opens the issue list when there is one. */
export function ValidationBadge({ status, issues, subject, testId = 'validation-badge' }: Props) {
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
          compact
          testId={`${testId}-modal`}
        >
          <S.Results>
            {subject && (
              <S.Subject data-testid={`${testId}-subject`}>
                {subject.thumbnail !== undefined && <S.Thumbnail src={subject.thumbnail} />}
                <S.SubjectText>
                  <S.SubjectName>{subject.name}</S.SubjectName>
                  <S.SubjectMeta>
                    <span>{t(`add_items_modal.type.${subject.type}`)}</span>
                    {subject.category && (
                      <>
                        <span aria-hidden>—</span>
                        <span>{t(`collection_detail_page.category.${subject.category}`)}</span>
                      </>
                    )}
                  </S.SubjectMeta>
                </S.SubjectText>
              </S.Subject>
            )}
            {hasIssues ? (
              <S.IssueList data-testid={`${testId}-issues`}>
                {issues.map(issue => (
                  <S.Issue key={`${issue.code}-${issue.where ?? ''}-${issue.message}`} data-severity={issue.severity}>
                    {issue.severity === ValidationSeverity.ERROR ? <ErrorIcon /> : <WarningIcon />}
                    <S.IssueText>
                      {issue.title && <strong>{issue.title}</strong>}
                      {issue.message}
                    </S.IssueText>
                  </S.Issue>
                ))}
              </S.IssueList>
            ) : (
              <S.Empty>{t('item_editor.validation.pass')}</S.Empty>
            )}
          </S.Results>
        </Modal>
      )}
    </>
  )
}

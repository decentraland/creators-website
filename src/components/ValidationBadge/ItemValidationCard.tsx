import { useState } from 'react'
import { BodyShape } from '@dcl/schemas'
import {
  ErrorOutline as WarningIcon,
  Refresh as RerunIcon,
  ReportProblemOutlined as ErrorIcon
} from '@mui/icons-material'
import { Tooltip } from '~/components/Tooltip'
import { useTranslation } from '~/intl'
import { type ItemType } from '~/lib/items'
import { ValidationSeverity, type ValidationIssue } from '~/lib/validation'
import * as S from './ItemValidationCard.styles'

/** The item the results are about, shown above them. */
export type ValidationSubject = {
  name: string
  type: ItemType
  category?: string
  /** Omitted (not null) when there is no artwork tile at all, e.g. a live preview. */
  thumbnail?: string | null
}

type Props = {
  subject?: ValidationSubject
  issues: ValidationIssue[]
  /** Checks the item again; the card shows a spinner until it settles. */
  onRerun?: () => Promise<unknown>
  testId?: string
}

function shapeLabel(shapes: BodyShape[] | undefined): 'male' | 'female' | null {
  if (!shapes || shapes.length !== 1) return null
  return shapes[0] === BodyShape.MALE ? 'male' : 'female'
}

/** One item's validation results: what it is, its issues (or that it passes) and a way to check it again. */
export function ItemValidationCard({ subject, issues, onRerun, testId = 'item-validation' }: Props) {
  const { t } = useTranslation()
  const [isRunning, setRunning] = useState(false)

  function rerun() {
    if (!onRerun || isRunning) return
    setRunning(true)
    void onRerun().finally(() => setRunning(false))
  }

  const rerunButton = onRerun && (
    <Tooltip content={t(isRunning ? 'item_validation.rerunning' : 'item_validation.rerun')} asChild>
      <S.Rerun
        type="button"
        aria-label={t('item_validation.rerun_label')}
        aria-disabled={isRunning || undefined}
        data-running={isRunning || undefined}
        data-testid={`${testId}-rerun`}
        onClick={rerun}
      >
        <RerunIcon />
      </S.Rerun>
    </Tooltip>
  )

  return (
    <S.Card data-testid={`${testId}-card`}>
      {(subject || rerunButton) && (
        <S.Header>
          {subject && (
            <>
              {subject.thumbnail !== undefined && <S.Thumbnail src={subject.thumbnail} />}
              <S.SubjectText data-testid={`${testId}-subject`}>
                <S.SubjectName>{subject.name}</S.SubjectName>
                <S.SubjectMeta>
                  <span>{t(`add_items_modal.type.${subject.type}`)}</span>
                  {subject.category && <span>{t(`collection_detail_page.category.${subject.category}`)}</span>}
                </S.SubjectMeta>
              </S.SubjectText>
            </>
          )}
          {rerunButton}
        </S.Header>
      )}
      {isRunning ? (
        <S.Running data-testid={`${testId}-running`}>
          <S.Spinner aria-hidden />
        </S.Running>
      ) : issues.length > 0 ? (
        <S.IssueList data-testid={`${testId}-issues`}>
          {issues.map((issue, index) => {
            const shape = shapeLabel(issue.bodyShapes)
            return (
              <S.Issue key={`${issue.code}-${issue.where ?? ''}-${index}`} data-severity={issue.severity}>
                {issue.severity === ValidationSeverity.ERROR ? <ErrorIcon /> : <WarningIcon />}
                <S.IssueText>
                  {(issue.title || shape) && (
                    <S.IssueTitle>
                      {issue.title && <strong>{issue.title}</strong>}
                      {shape && (
                        <S.ShapeLabel data-testid={`${testId}-shape`}>
                          {t(`item_validation.body_shape.${shape}`)}
                        </S.ShapeLabel>
                      )}
                    </S.IssueTitle>
                  )}
                  {issue.message}
                </S.IssueText>
              </S.Issue>
            )
          })}
        </S.IssueList>
      ) : (
        <S.Empty data-testid={`${testId}-pass`}>{t('item_editor.validation.pass')}</S.Empty>
      )}
    </S.Card>
  )
}

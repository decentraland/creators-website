import {
  CheckCircleOutline as PassedIcon,
  HelpOutline as UnsupportedIcon,
  ReportProblemOutlined as IssuesIcon
} from '@mui/icons-material'
import { type CuratorVerdictOutcome } from '~/lib/events'
import * as S from './AutomatedReviewIcon.styles'

export type AutomatedReviewStatus = CuratorVerdictOutcome | 'running'

/** The automated review's outcome as one colored glyph, or a spinner while it runs. */
export function AutomatedReviewIcon({ status }: { status: AutomatedReviewStatus }) {
  return (
    <S.Glyph data-status={status} aria-hidden>
      {status === 'running' ? (
        <S.Spinner />
      ) : status === 'passed' ? (
        <PassedIcon fontSize="inherit" />
      ) : status === 'rejected' ? (
        <IssuesIcon fontSize="inherit" />
      ) : (
        <UnsupportedIcon fontSize="inherit" />
      )}
    </S.Glyph>
  )
}

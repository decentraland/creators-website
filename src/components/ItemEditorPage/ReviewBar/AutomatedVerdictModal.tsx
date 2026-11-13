import { useMemo } from 'react'
import { useIntl } from 'react-intl'
import {
  CheckCircleOutline as PassedIcon,
  ErrorOutline as WarningIcon,
  HelpOutline as UncheckedIcon,
  ReportProblemOutlined as IssuesIcon
} from '@mui/icons-material'
import { useTranslation } from '~/intl'
import { Modal } from '~/components/Modal'
import { ItemValidationCard } from '~/components/ValidationBadge'
import { getContentsStorageUrl } from '~/lib/builder'
import {
  countFailedItems,
  groupVerdictItems,
  toCuratorIssues,
  type CuratorVerdict,
  type ValidationItemResult
} from '~/lib/events'
import { type Item } from '~/lib/items'
import { formatTimeAgo } from '~/lib/time'
import * as S from './AutomatedVerdictModal.styles'

type Props = {
  verdict: CuratorVerdict
  /** The creator asked for a curator after the automated review. */
  requestedByCreator?: boolean
  items: Item[]
  onClose: () => void
}

/** The validator's latest verdict for the curator: failed items open first, the rest folded by outcome. */
export function AutomatedVerdictModal({ verdict, requestedByCreator = false, items, onClose }: Props) {
  const { t } = useTranslation()
  const intl = useIntl()
  const results = verdict.payload.items
  const outcome = verdict.outcome
  const groups = useMemo(() => groupVerdictItems(results), [results])
  const byId = useMemo(() => new Map(items.map(item => [item.id, item])), [items])
  // A section only helps tell outcomes apart: one item, or items that all share an outcome, are listed as they are.
  const flat =
    results.length === 1 || [groups.failed, groups.unchecked, groups.passed].filter(g => g.length).length === 1

  const row = (result: ValidationItemResult) => (
    <ItemRow
      key={result.itemId}
      result={result}
      item={byId.get(result.itemId)}
      defaultOpen={results.length === 1 || result.passed === false}
    />
  )

  return (
    <Modal
      title={t('automated_verdict.title')}
      onClose={onClose}
      size="medium"
      compact
      testId="automated-verdict-modal"
    >
      <S.Body>
        <S.Banner data-outcome={outcome} data-testid="automated-verdict-headline">
          <S.BannerLine>
            {outcome === 'passed' ? (
              <PassedIcon aria-hidden />
            ) : outcome === 'rejected' ? (
              <IssuesIcon aria-hidden />
            ) : (
              <UncheckedIcon aria-hidden />
            )}
            <span>
              {outcome === 'passed'
                ? t('automated_verdict.banner_passed')
                : outcome === 'rejected'
                  ? t('automated_verdict.banner_issues', { failed: countFailedItems(results), total: results.length })
                  : t('automated_verdict.status_unsupported')}
            </span>
            <S.Time>{formatTimeAgo(verdict.createdAt, intl.locale)}</S.Time>
          </S.BannerLine>
          {requestedByCreator && (
            <S.Reason data-testid="automated-verdict-reason">{t('automated_verdict.reason_requested')}</S.Reason>
          )}
        </S.Banner>
        <S.Items data-testid="automated-verdict-items">
          {flat ? (
            results.map(row)
          ) : (
            <>
              {groups.failed.map(row)}
              {groups.unchecked.length > 0 && (
                <S.Group data-testid="automated-verdict-unchecked">
                  <S.GroupSummary>
                    {t('automated_verdict.unchecked_group', { count: groups.unchecked.length })}
                  </S.GroupSummary>
                  <S.GroupItems>{groups.unchecked.map(row)}</S.GroupItems>
                </S.Group>
              )}
              {groups.passed.length > 0 && (
                <S.Group data-testid="automated-verdict-passed">
                  <S.GroupSummary>
                    {t('automated_verdict.passed_group', { count: groups.passed.length })}
                  </S.GroupSummary>
                  <S.GroupItems>{groups.passed.map(row)}</S.GroupItems>
                </S.Group>
              )}
            </>
          )}
        </S.Items>
      </S.Body>
    </Modal>
  )
}

type RowProps = { result: ValidationItemResult; item?: Item; defaultOpen: boolean }

/** One item as a box, its outcome as icons at the end of its row. */
function ItemRow({ result, item, defaultOpen }: RowProps) {
  const { t } = useTranslation()
  const issues = useMemo(() => toCuratorIssues(result.findings, item?.contents), [result.findings, item?.contents])
  const errors = useMemo(() => result.findings.filter(finding => finding.severity === 'error').length, [result])
  const warnings = result.findings.length - errors
  const visualRows = useMemo(
    () =>
      (result.visualSummary ?? '')
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean),
    [result.visualSummary]
  )
  const thumbnail = item?.contents[item.thumbnail]
  const outcome = result.passed === true ? 'passed' : result.passed === false ? 'failed' : 'unchecked'
  const unchecked = t(result.unsupported ? 'findings.item_unsupported' : 'findings.item_unchecked')
  const testId = `automated-verdict-items-${result.itemId}`

  return (
    <S.Item open={defaultOpen || undefined} data-outcome={outcome} data-testid={testId}>
      <S.ItemSummary>
        {thumbnail ? <S.Thumb src={getContentsStorageUrl(thumbnail)} alt="" /> : <S.ThumbPlaceholder />}
        <S.ItemName>{item?.name ?? t('findings.unknown_item', { id: result.itemId.slice(0, 8) })}</S.ItemName>
        <S.Status data-testid={`${testId}-status`}>
          {outcome === 'unchecked' ? (
            <S.Count data-kind="unchecked" title={unchecked} aria-label={unchecked}>
              <UncheckedIcon fontSize="small" />
            </S.Count>
          ) : errors === 0 && warnings === 0 ? (
            <S.Count data-kind="passed" title={t('findings.item_passed')} aria-label={t('findings.item_passed')}>
              <PassedIcon fontSize="small" />
            </S.Count>
          ) : (
            <>
              {errors > 0 && (
                <S.Count
                  data-kind="error"
                  title={t('automated_verdict.errors', { count: errors })}
                  aria-label={t('automated_verdict.errors', { count: errors })}
                >
                  <IssuesIcon fontSize="small" />
                  {errors}
                </S.Count>
              )}
              {warnings > 0 && (
                <S.Count
                  data-kind="warning"
                  title={t('automated_verdict.warnings', { count: warnings })}
                  aria-label={t('automated_verdict.warnings', { count: warnings })}
                >
                  <WarningIcon fontSize="small" />
                  {warnings}
                </S.Count>
              )}
            </>
          )}
        </S.Status>
      </S.ItemSummary>
      <S.ItemBody>
        {result.passed === null && result.error && <S.Note>{t('findings.item_error', { error: result.error })}</S.Note>}
        {visualRows.length > 0 && (
          <S.Visual data-testid="automated-verdict-items-visual-summary">
            <S.VisualTitle>{t('findings.visual_summary')}</S.VisualTitle>
            {visualRows.map((line, index) => (
              <S.VisualLine key={index}>{line}</S.VisualLine>
            ))}
          </S.Visual>
        )}
        {(issues.length > 0 || outcome !== 'unchecked') && <ItemValidationCard issues={issues} testId={testId} />}
      </S.ItemBody>
    </S.Item>
  )
}

import { useMemo, useState } from 'react'
import {
  CheckCircleOutline as PassedIcon,
  ErrorOutline as ErrorIcon,
  WarningAmber as WarningIcon
} from '@mui/icons-material'
import { useTranslation } from '~/intl'
import { Button } from '~/components/Button'
import { ItemFindingsList } from '~/components/FindingsList'
import { type useStaticChecks } from '~/hooks/useStaticChecks'
import { type Item } from '~/lib/items'
import * as S from './StaticChecksPanel.styles'

type Props = {
  checks: ReturnType<typeof useStaticChecks>
  items: Item[]
}

/** The pre-fee static checks: a status line, the blocking findings per item, warnings behind a toggle. */
export function StaticChecksPanel({ checks, items }: Props) {
  const { t } = useTranslation()
  const [showWarnings, setShowWarnings] = useState(false)
  const result = checks.data
  const groups = useMemo(() => {
    if (!result) return { errors: [], warnings: [] }
    const bySeverity = (severity: 'error' | 'warning') =>
      result.items
        .map(item => ({
          itemId: item.itemId,
          findings: item.findings.filter(finding => finding.severity === severity)
        }))
        .filter(item => item.findings.length > 0)
    return { errors: bySeverity('error'), warnings: bySeverity('warning') }
  }, [result])

  if (checks.isFetching || (!result && !checks.isError && checks.fetchStatus !== 'idle')) {
    return (
      <S.Status data-state="checking" data-testid="static-checks" aria-busy="true">
        <S.Spinner aria-hidden />
        {checks.progress
          ? t('static_checks.checking', { done: checks.progress.done, total: checks.progress.total })
          : t('static_checks.preparing')}
      </S.Status>
    )
  }

  if (checks.isError || !result) {
    if (!checks.isError) return null
    return (
      <S.Status data-state="failed" data-testid="static-checks">
        <WarningIcon fontSize="small" aria-hidden />
        {t('static_checks.failed')}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          data-testid="static-checks-retry"
          onClick={() => void checks.refetch()}
        >
          {t('static_checks.retry')}
        </Button>
      </S.Status>
    )
  }

  return (
    <S.Wrap
      data-testid="static-checks"
      data-state={result.errors > 0 ? 'errors' : result.warnings > 0 ? 'warnings' : 'passed'}
    >
      <S.Status data-state={result.errors > 0 ? 'errors' : result.warnings > 0 ? 'warnings' : 'passed'}>
        {result.errors > 0 ? (
          <>
            <ErrorIcon fontSize="small" aria-hidden />
            {t('static_checks.errors', { count: result.errors })}
          </>
        ) : result.warnings > 0 ? (
          <>
            <WarningIcon fontSize="small" aria-hidden />
            {t('static_checks.warnings', { count: result.warnings })}
          </>
        ) : (
          <>
            <PassedIcon fontSize="small" aria-hidden />
            {t('static_checks.passed')}
          </>
        )}
      </S.Status>
      {groups.errors.length > 0 && (
        <ItemFindingsList results={groups.errors} items={items} showStatus={false} testId="static-checks-errors" />
      )}
      {groups.warnings.length > 0 && (
        <>
          <S.Toggle
            type="button"
            aria-expanded={showWarnings}
            data-testid="static-checks-toggle-warnings"
            onClick={() => setShowWarnings(open => !open)}
          >
            {t(showWarnings ? 'static_checks.hide_warnings' : 'static_checks.show_warnings')}
          </S.Toggle>
          {showWarnings && (
            <ItemFindingsList
              results={groups.warnings}
              items={items}
              showStatus={false}
              testId="static-checks-warnings"
            />
          )}
        </>
      )}
    </S.Wrap>
  )
}

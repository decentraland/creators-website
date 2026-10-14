import { useMemo } from 'react'
import { useTranslation } from '~/intl'
import { getContentsStorageUrl } from '~/lib/builder'
import { mergeBodyShapeFindings, type ValidationFinding, type ValidationItemResult } from '~/lib/events'
import { type Item } from '~/lib/items'
import { isWebUrl, openExternal } from '~/lib/navigation'
import * as S from './FindingsList.styles'

type ShownFinding = Omit<ValidationFinding, 'measured' | 'limit'> & {
  measured?: number | string
  limit?: number | string
}

type ListProps = {
  findings: ShownFinding[]
  testId?: string
}

/** Validator findings, one card each: rule, body shapes, message, measured vs limit, fix and docs. */
export function FindingsList({ findings, testId = 'findings' }: ListProps) {
  const { t } = useTranslation()
  const rows = useMemo(() => mergeBodyShapeFindings(findings), [findings])
  if (rows.length === 0) return null
  return (
    <S.List data-testid={testId}>
      {rows.map((finding, index) => (
        <S.Finding key={`${finding.rule}-${index}`} data-severity={finding.severity} data-testid={`${testId}-finding`}>
          <S.Head>
            <S.Severity data-severity={finding.severity}>{t(`findings.severity.${finding.severity}`)}</S.Severity>
            <S.Rule>{finding.rule}</S.Rule>
            {finding.bodyShapes.length > 0 && (
              <S.BodyShapes data-testid={`${testId}-body-shapes`}>
                {finding.bodyShapes.map(shape => t(`findings.body_shape.${shape}`)).join(' · ')}
              </S.BodyShapes>
            )}
            {finding.where && <S.Where>{finding.where}</S.Where>}
          </S.Head>
          <S.Message>{finding.message}</S.Message>
          {(finding.measured !== undefined || finding.limit !== undefined) && (
            <S.Meta>
              {finding.measured !== undefined && <span>{t('findings.measured', { measured: finding.measured })}</span>}
              {finding.limit !== undefined && <span>{t('findings.limit', { limit: finding.limit })}</span>}
            </S.Meta>
          )}
          {finding.fix && (
            <S.Fix>
              <strong>{t('findings.fix')}:</strong> {finding.fix}
            </S.Fix>
          )}
          {isWebUrl(finding.docs) && (
            <S.DocsLink
              href={finding.docs}
              onClick={event => {
                event.preventDefault()
                openExternal(finding.docs!)
              }}
            >
              {t('findings.docs')}
            </S.DocsLink>
          )}
        </S.Finding>
      ))}
    </S.List>
  )
}

type ItemFindings = Pick<ValidationItemResult, 'itemId'> & { findings: ShownFinding[] } & Partial<
    Pick<ValidationItemResult, 'passed' | 'visualSummary' | 'unsupported' | 'error'>
  >

type GroupedProps = {
  results: ItemFindings[]
  /** The collection's items, to show names and thumbnails; unknown ids fall back to a short id. */
  items?: Item[]
  /** Hides the pass/fail label per item (the pre-fee checks have no verdict). */
  showStatus?: boolean
  testId?: string
}

/** Findings grouped by item, with the item's thumbnail, name and (optionally) its pass/fail and visual summary. */
export function ItemFindingsList({ results, items = [], showStatus = true, testId = 'item-findings' }: GroupedProps) {
  const { t } = useTranslation()
  const byId = useMemo(() => new Map(items.map(item => [item.id, item])), [items])
  return (
    <S.Groups data-testid={testId}>
      {results.map(result => {
        const item = byId.get(result.itemId)
        const thumbnail = item?.contents[item.thumbnail]
        const passed = result.passed === undefined ? undefined : result.passed
        return (
          <S.ItemGroup key={result.itemId} data-testid={`${testId}-item`} data-item-id={result.itemId}>
            <S.ItemHead>
              {thumbnail && <S.ItemThumb src={getContentsStorageUrl(thumbnail)} alt="" />}
              <span>{item?.name ?? t('findings.unknown_item', { id: result.itemId.slice(0, 8) })}</span>
              {showStatus && passed !== undefined && (
                <S.ItemStatus data-passed={String(passed)}>
                  {t(
                    passed === true
                      ? 'findings.item_passed'
                      : passed === false
                        ? 'findings.item_failed'
                        : result.unsupported
                          ? 'findings.item_unsupported'
                          : 'findings.item_unchecked'
                  )}
                </S.ItemStatus>
              )}
            </S.ItemHead>
            {result.passed === null && result.error && (
              <S.ItemError data-testid={`${testId}-item-error`}>
                {t('findings.item_error', { error: result.error })}
              </S.ItemError>
            )}
            <FindingsList findings={result.findings} testId={`${testId}-${result.itemId}`} />
            {result.visualSummary && (
              <S.Summary data-testid={`${testId}-visual-summary`}>
                <strong>{t('findings.visual_summary')}:</strong> {result.visualSummary}
              </S.Summary>
            )}
          </S.ItemGroup>
        )
      })}
    </S.Groups>
  )
}

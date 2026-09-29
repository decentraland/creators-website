import { useMemo } from 'react'
import { useIntl } from 'react-intl'
import { useTranslation } from '~/intl'
import { Button } from '~/components/Button'
import { ItemFindingsList } from '~/components/FindingsList'
import { Modal } from '~/components/Modal'
import { countFailedItems, type CollectionEvent, type ValidationVerdictPayload } from '~/lib/events'
import { type Item } from '~/lib/items'
import { formatTimeAgo } from '~/lib/time'
import * as S from './AiVerdictModal.styles'

type Props = {
  verdict: CollectionEvent & { payload: ValidationVerdictPayload }
  items: Item[]
  onClose: () => void
}

/** The validator's latest verdict for the curator: per item pass/fail, findings and the visual summary. */
export function AiVerdictModal({ verdict, items, onClose }: Props) {
  const { t } = useTranslation()
  const intl = useIntl()
  const passed = verdict.payload.verdict === 'passed'
  const totals = useMemo(() => {
    const findings = verdict.payload.items.flatMap(item => item.findings)
    return {
      failed: countFailedItems(verdict.payload.items),
      errors: findings.filter(finding => finding.severity === 'error').length,
      warnings: findings.filter(finding => finding.severity === 'warning').length
    }
  }, [verdict])

  return (
    <Modal title={t('ai_verdict.title')} onClose={onClose} size="large" testId="ai-verdict-modal">
      <S.Body>
        <S.Headline data-passed={passed} data-testid="ai-verdict-headline">
          {t(passed ? 'ai_verdict.passed' : 'ai_verdict.rejected', {
            time: formatTimeAgo(verdict.createdAt, intl.locale)
          })}
        </S.Headline>
        <S.Summary>{t('ai_verdict.summary', totals)}</S.Summary>
        {verdict.payload.validationId && (
          <S.ValidationId data-testid="ai-verdict-validation-id">
            {t('ai_verdict.validation_id', { id: verdict.payload.validationId })}
          </S.ValidationId>
        )}
        <ItemFindingsList results={verdict.payload.items} items={items} testId="ai-verdict-items" />
        <S.Actions>
          <Button type="button" variant="secondary" onClick={onClose}>
            {t('ai_verdict.close')}
          </Button>
        </S.Actions>
      </S.Body>
    </Modal>
  )
}

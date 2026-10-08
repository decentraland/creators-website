import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from '~/intl'
import { useRerunItemValidation } from '~/hooks/useCollectionValidation'
import { track } from '~/lib/analytics'
import { countIssues, getValidationStatus, hasErrors } from '~/lib/validation'
import { PendingModal } from '~/components/PendingModal'
import { ValidationIssuesView, type ItemCheck } from './ValidationIssuesView'

export type ValidationFlow = 'publish' | 'push_changes'

type Props = {
  collectionId: string
  flow: ValidationFlow
  /** The collection's item checks, run by the page; items still loading count as validating. */
  validation: { isValidating: boolean; results: ItemCheck[] }
  /** Errors block the flow (`block-publish-on-validation-errors`): no way past the issues view while any remain. */
  blockOnErrors: boolean
  onPass: () => void
  onClose: () => void
}

function totals(checks: ItemCheck[]) {
  return countIssues(checks.flatMap(check => check.issues))
}

/**
 * The pre-step before publishing or sending changes for review: waits for the item checks, then shows
 * anything they found. Clean results pass straight through; the decision is made once per opening.
 */
export function ValidationGate({ collectionId, flow, validation, blockOnErrors, onPass, onClose }: Props) {
  const { t } = useTranslation()
  const [decided, setDecided] = useState(false)
  const openedAt = useRef(Date.now())
  // The items the issues view lists: those with issues when it opened, errors first. A re-run that clears
  // one keeps its card so the creator sees it pass.
  const [flaggedIds, setFlaggedIds] = useState<string[]>([])

  useEffect(() => {
    track('Publish Validation Started', { collectionId, flow, itemCount: validation.results.length })
    // Once per opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (decided || validation.isValidating) return
    const flagged = validation.results.filter(check => check.issues.length > 0)
    const { errors, warnings } = totals(flagged)
    track('Publish Validation Result', {
      collectionId,
      flow,
      errors,
      warnings,
      itemsWithIssues: flagged.length,
      blocking: blockOnErrors && errors > 0,
      durationMs: Date.now() - openedAt.current
    })
    setDecided(true)
    if (flagged.length === 0) {
      onPass()
      return
    }
    const withErrors = flagged.filter(check => hasErrors(check.issues))
    const withWarnings = flagged.filter(check => !hasErrors(check.issues))
    setFlaggedIds([...withErrors, ...withWarnings].map(({ item }) => item.id))
  }, [decided, validation, blockOnErrors, collectionId, flow, onPass])

  const flaggedChecks = useMemo(() => {
    const byId = new Map(validation.results.map(check => [check.item.id, check]))
    return flaggedIds.flatMap(id => byId.get(id) ?? [])
  }, [flaggedIds, validation.results])
  const rerunItemValidation = useRerunItemValidation()
  const rerun = useCallback(
    (check: ItemCheck) => rerunItemValidation(check.item, flow, getValidationStatus(check.issues, false)),
    [rerunItemValidation, flow]
  )
  function resolveIssues(action: 'continue' | 'back') {
    track('Publish Validation Resolved', { collectionId, flow, action, ...totals(flaggedChecks) })
    if (action === 'continue') onPass()
    else onClose()
  }

  if (!decided) {
    return <PendingModal label={t('item_validation.checking')} onCancel={onClose} testId="publish-validating" />
  }

  return (
    <ValidationIssuesView
      checks={flaggedChecks}
      flow={flow}
      blockOnErrors={blockOnErrors}
      onRerun={rerun}
      onBack={() => resolveIssues('back')}
      onContinue={() => resolveIssues('continue')}
    />
  )
}

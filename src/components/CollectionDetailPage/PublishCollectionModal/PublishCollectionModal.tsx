import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from '~/intl'
import { useAllCollectionItems, useSaveCollection } from '~/hooks/useCollection'
import { useRerunItemValidation } from '~/hooks/useCollectionValidation'
import { track } from '~/lib/analytics'
import { countIssues, getValidationStatus, hasErrors } from '~/lib/validation'
import { type Session } from '~/lib/auth'
import { type Collection } from '~/lib/collections'
import { type TopUpResume } from '~/lib/creditsTopUp'
import { type PaymentMethod, type PublishCollectionError, type PublishResult } from '~/lib/publishCollection'
import { Modal } from '~/components/Modal'
import { PendingModal } from '../SellItemFlow/PendingModal'
import { ConfirmItemsStep } from './ConfirmItemsStep'
import { ConfirmNameStep } from './ConfirmNameStep'
import { PaymentStep } from './PaymentStep'
import { PublishErrorModal } from './PublishErrorModal'
import { TopUpOutcome } from './TopUpOutcome'
import { ValidationIssuesView, type ItemCheck } from './ValidationIssuesView'
import { StepIndicator } from '~/components/StepIndicator'
import * as S from './PublishCollectionModal.styles'

enum Step {
  Name = 1,
  Items,
  Payment
}

const TOTAL_STEPS = 3

/** Where a creator back from buying credits picks the wizard up: the payment step, with the order to settle. */
export type PublishResume = Pick<TopUpResume, 'paymentMethod' | 'termsAccepted'> & {
  /** Null when the checkout was cancelled: nothing to wait for. */
  orderId: string | null
}

/** Before the wizard: wait for the item checks, then show what they found. Decided once, never revisited. */
type Phase = 'validating' | 'issues' | 'wizard'

type Props = {
  collection: Collection
  session: Session
  resume?: PublishResume
  /** The collection's item checks, run by the page; items still loading count as validating. */
  validation: { isValidating: boolean; results: ItemCheck[] }
  /** Errors block publishing (`block-publish-on-validation-errors`): no way past the issues view while any remain. */
  blockOnErrors: boolean
  onClose: () => void
  onPublished: (result: PublishResult) => void
}

function totals(checks: ItemCheck[]) {
  return countIssues(checks.flatMap(check => check.issues))
}

/**
 * The three-step publish wizard: confirm name → review items → confirm & pay, after a pre-step that waits for
 * the item checks and shows anything they found. A failed publish swaps in the error dialog; TRY AGAIN comes
 * back here on the payment step with everything kept.
 */
export function PublishCollectionModal({
  collection,
  session,
  resume,
  validation,
  blockOnErrors,
  onClose,
  onPublished
}: Props) {
  const { t } = useTranslation()
  const { address } = session

  const [phase, setPhase] = useState<Phase>(resume ? 'wizard' : 'validating')
  const openedAt = useRef(Date.now())
  // The items the issues view lists: those with issues when it opened, errors first. A re-run that clears
  // one keeps its card so the creator sees it pass.
  const [flaggedIds, setFlaggedIds] = useState<string[]>([])
  const collectionId = collection.id

  useEffect(() => {
    if (!resume) track('Publish Validation Started', { collectionId, itemCount: validation.results.length })
    // Once per opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (phase !== 'validating' || validation.isValidating) return
    const flagged = validation.results.filter(check => check.issues.length > 0)
    const { errors, warnings } = totals(flagged)
    track('Publish Validation Result', {
      collectionId,
      errors,
      warnings,
      itemsWithIssues: flagged.length,
      blocking: blockOnErrors && errors > 0,
      durationMs: Date.now() - openedAt.current
    })
    if (flagged.length === 0) {
      setPhase('wizard')
      return
    }
    const withErrors = flagged.filter(check => hasErrors(check.issues))
    const withWarnings = flagged.filter(check => !hasErrors(check.issues))
    setFlaggedIds([...withErrors, ...withWarnings].map(({ item }) => item.id))
    setPhase('issues')
  }, [phase, validation, blockOnErrors, collectionId])

  const flaggedChecks = useMemo(() => {
    const byId = new Map(validation.results.map(check => [check.item.id, check]))
    return flaggedIds.flatMap(id => byId.get(id) ?? [])
  }, [flaggedIds, validation.results])
  const rerunItemValidation = useRerunItemValidation()
  const rerun = useCallback(
    (check: ItemCheck) => rerunItemValidation(check.item, 'publish', getValidationStatus(check.issues, false)),
    [rerunItemValidation]
  )
  function resolveIssues(action: 'continue' | 'back') {
    track('Publish Validation Resolved', { collectionId, action, ...totals(flaggedChecks) })
    if (action === 'continue') setPhase('wizard')
    else onClose()
  }

  const [step, setStep] = useState<Step>(resume ? Step.Payment : Step.Name)
  const [error, setError] = useState<PublishCollectionError | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(resume?.paymentMethod ?? null)
  const [termsAccepted, setTermsAccepted] = useState(resume?.termsAccepted ?? false)
  const [isStepBusy, setStepBusy] = useState(false)
  const [settlingOrder, setSettlingOrder] = useState<string | null>(resume?.orderId ?? null)
  const settleOrder = useCallback(() => setSettlingOrder(null), [])

  const itemsQuery = useAllCollectionItems(address, collection.id)
  const items = itemsQuery.data ?? []
  const saveCollection = useSaveCollection(address)

  function confirmName(name: string) {
    if (name === collection.name) {
      setStep(Step.Items)
      return
    }
    saveCollection.mutate({ ...collection, name }, { onSuccess: () => setStep(Step.Items) })
  }

  if (phase === 'validating') {
    return <PendingModal label={t('item_validation.checking')} onCancel={onClose} testId="publish-validating" />
  }

  if (phase === 'issues') {
    return (
      <ValidationIssuesView
        checks={flaggedChecks}
        blockOnErrors={blockOnErrors}
        onRerun={rerun}
        onBack={() => resolveIssues('back')}
        onContinue={() => resolveIssues('continue')}
      />
    )
  }

  if (error) {
    return (
      <PublishErrorModal
        reason={error.reason}
        onCancel={onClose}
        onRetry={() => {
          setError(null)
          setStep(Step.Payment)
        }}
      />
    )
  }

  const busy = saveCollection.isPending || isStepBusy

  return (
    <Modal
      title={t('publish_collection_modal.title')}
      size="large"
      onClose={onClose}
      closeDisabled={busy}
      testId="publish-collection-modal"
    >
      <S.Main>
        <StepIndicator current={step} total={TOTAL_STEPS} testId="publish-steps" />
        {step === Step.Name && (
          <ConfirmNameStep
            initialName={collection.name}
            isSaving={saveCollection.isPending}
            saveError={saveCollection.error?.message ?? null}
            onCancel={onClose}
            onConfirm={confirmName}
          />
        )}
        {step === Step.Items &&
          (itemsQuery.isLoading ? (
            <S.InlineNote data-testid="publish-items-loading">
              <S.Spinner aria-hidden />
            </S.InlineNote>
          ) : (
            <ConfirmItemsStep
              address={address}
              items={items}
              onBusyChange={setStepBusy}
              onBack={() => setStep(Step.Name)}
              onConfirm={() => setStep(Step.Payment)}
            />
          ))}
        {step === Step.Payment && (
          <PaymentStep
            collection={collection}
            items={items}
            session={session}
            paymentMethod={paymentMethod}
            onPaymentMethodChange={setPaymentMethod}
            accepted={termsAccepted}
            onAcceptedChange={setTermsAccepted}
            onBusyChange={setStepBusy}
            onBack={() => setStep(Step.Items)}
            onPublished={onPublished}
            onFailed={setError}
          />
        )}
      </S.Main>
      {settlingOrder && <TopUpOutcome address={address} orderId={settlingOrder} onDone={settleOrder} />}
    </Modal>
  )
}

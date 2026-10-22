import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from '~/intl'
import { useSaveCollection } from '~/hooks/useCollection'
import { useThirdPartySlots } from '~/hooks/useLinkedCollection'
import { usePublishLinkedItems, useSignSlotsCheque, useThirdPartyPrice } from '~/hooks/useLinkedPublish'
import { useProfile } from '~/hooks/useProfile'
import { useBeforeUnloadGuard } from '~/hooks/useBeforeUnloadGuard'
import { track } from '~/lib/analytics'
import { type Session } from '~/lib/auth'
import { type SlotsCheque } from '~/lib/builder'
import { type Collection } from '~/lib/collections'
import { type Item } from '~/lib/items'
import { type ItemCuration } from '~/lib/linkedItemStatus'
import {
  LinkedPublishError,
  getResumableTxHash,
  mayHavePublished,
  type LinkedPublishStep
} from '~/lib/publishLinkedItems'
import { LINKED_COLLECTION_NAME_MAX_LENGTH, type ThirdParty } from '~/lib/thirdParty'
import { Modal } from '~/components/Modal'
import { PendingModal } from '~/components/PendingModal'
import { StepIndicator } from '~/components/StepIndicator'
import { ConfirmNameStep } from '../../PublishCollectionModal/ConfirmNameStep'
import * as S from '../../PublishCollectionModal/PublishCollectionModal.styles'
import { LinkedItemsStep } from './LinkedItemsStep'
import { LinkedKindStep } from './LinkedKindStep'
import { LinkedPaymentStep } from './LinkedPaymentStep'
import { LinkedPublishOutcomeModal } from './LinkedPublishOutcomeModal'

type Step = 'name' | 'items' | 'kind' | 'payment'

type Props = {
  collection: Collection
  thirdParty: ThirdParty
  session: Session
  itemsToPublish: Item[]
  itemsToPush: Item[]
  curations: Map<string, ItemCuration>
  onClose: () => void
  onPublished: () => void
}

// Steps whose work the creator pays for or that the server already recorded: closing mid-way would strand it.
const RUNNING_STEP_ORDER: LinkedPublishStep[] = [
  'tos',
  'kind',
  'allowance',
  'register',
  'buy_slots',
  'wait_tx',
  'delete_virtual',
  'publish',
  'push'
]

/**
 * The linked publish wizard (legacy PublishWizardCollectionModal for third parties): confirm name and email →
 * confirm items and sign the slots cheque → pick the third party's kind on its first publish → pay the slots in
 * MANA and submit for review.
 */
export function PublishLinkedItemsModal({
  collection,
  thirdParty,
  session,
  itemsToPublish,
  itemsToPush,
  curations,
  onClose,
  onPublished
}: Props) {
  const { t } = useTranslation()
  const { address } = session
  const needsKind = !thirdParty.published
  const steps = useMemo<Step[]>(
    () => ['name', 'items', ...(needsKind ? (['kind'] as const) : []), 'payment'],
    [needsKind]
  )
  const [step, setStep] = useState<Step>('name')
  const [email, setEmail] = useState('')
  const [cheque, setCheque] = useState<SlotsCheque | null>(null)
  const [isProgrammatic, setProgrammatic] = useState(thirdParty.isProgrammatic)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [runningStep, setRunningStep] = useState<LinkedPublishStep | null>(null)
  const [outcome, setOutcome] = useState<'success' | LinkedPublishError | null>(null)
  // What earlier attempts left behind: a payment a retry must resume from, and a publish request that may have landed.
  const [paidTxHash, setPaidTxHash] = useState<string | undefined>(undefined)
  const [publishMayHaveLanded, setPublishMayHaveLanded] = useState(false)

  const profile = useProfile(address)
  const profileEmail = profile.data?.email?.trim() ?? ''
  const saveCollection = useSaveCollection(address)
  const signCheque = useSignSlotsCheque(session)
  const price = useThirdPartyPrice()
  const slots = useThirdPartySlots(address, thirdParty.id)
  const publish = usePublishLinkedItems(session, collection)
  const isRunning = publish.isPending
  const runningLabels = useMemo(
    () => RUNNING_STEP_ORDER.map(name => t(`publish_linked_modal.running.short.${name}`)),
    [t]
  )
  useBeforeUnloadGuard(isRunning)

  useEffect(() => {
    track('Publish TP Items started', {
      collectionId: collection.id,
      thirdPartyId: thirdParty.id,
      items: itemsToPublish.length,
      pushed: itemsToPush.length
    })
    // Once per wizard opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const stepIndex = steps.indexOf(step)
  const goTo = useCallback((next: Step) => setStep(next), [])
  const back = () => goTo(steps[Math.max(0, stepIndex - 1)])
  const forward = () => goTo(steps[Math.min(steps.length - 1, stepIndex + 1)])

  function confirmDetails(details: { name: string; email: string }) {
    setEmail(details.email)
    if (details.name === collection.name || collection.isPublished) return forward()
    saveCollection.mutate({ ...collection, name: details.name }, { onSuccess: forward })
  }

  function confirmItems() {
    if (itemsToPublish.length === 0 || cheque) return forward()
    signCheque.mutate(
      { thirdPartyId: thirdParty.id, qty: itemsToPublish.length },
      {
        onSuccess: signed => {
          track('Sign TP cheque', { collectionId: collection.id, thirdPartyId: thirdParty.id, qty: signed.qty })
          setCheque(signed)
          forward()
        }
      }
    )
  }

  async function submit() {
    if (!price.data) return
    setRunningStep('tos')
    // Read again right before paying: the slots an earlier attempt bought must not be bought twice.
    const fresh = paidTxHash ? slots.data : (await slots.refetch()).data
    if (fresh === undefined) {
      setRunningStep(null)
      return
    }
    publish.mutate(
      {
        collection,
        thirdParty,
        itemsToPublish,
        itemsToPush,
        cheque,
        email,
        isProgrammatic,
        availableSlots: fresh,
        price: price.data,
        paidTxHash,
        publishMayHaveLanded,
        curations,
        onStep: setRunningStep
      },
      {
        onSuccess: () => {
          setOutcome('success')
          onPublished()
        },
        onError: error => {
          const failure =
            error instanceof LinkedPublishError ? error : new LinkedPublishError('publish', 'generic', String(error))
          setPaidTxHash(current => getResumableTxHash(failure) ?? current)
          setPublishMayHaveLanded(current => current || mayHavePublished(failure))
          setOutcome(failure)
        },
        onSettled: () => setRunningStep(null)
      }
    )
  }

  if (outcome) {
    return (
      <LinkedPublishOutcomeModal
        outcome={outcome}
        collection={collection}
        onClose={onClose}
        onRetry={() => {
          setOutcome(null)
          // The server refusing the ToS most likely means the email: back to the first step.
          goTo(outcome !== 'success' && outcome.reason === 'tos_failed' ? 'name' : 'payment')
        }}
      />
    )
  }

  if (isRunning && runningStep) {
    return (
      <PendingModal
        title={t('publish_linked_modal.running.title')}
        label={t(`publish_linked_modal.running.${runningStep}`)}
        steps={{
          labels: runningLabels,
          current: RUNNING_STEP_ORDER.indexOf(runningStep) + 1
        }}
        testId="publish-linked-running"
      />
    )
  }

  const busy = saveCollection.isPending || signCheque.isPending

  return (
    <Modal
      title={t('publish_linked_modal.title')}
      size="large"
      onClose={onClose}
      closeDisabled={busy}
      testId="publish-linked-modal"
    >
      <S.Main>
        <StepIndicator current={stepIndex + 1} total={steps.length} testId="publish-linked-steps" />
        {step === 'name' &&
          (profile.isLoading ? (
            <S.InlineNote data-testid="publish-name-loading">
              <S.Spinner aria-hidden />
            </S.InlineNote>
          ) : (
            <ConfirmNameStep
              initialName={collection.name}
              initialEmail={email || profileEmail}
              isSaving={saveCollection.isPending}
              saveError={saveCollection.error?.message ?? null}
              nameMaxLength={LINKED_COLLECTION_NAME_MAX_LENGTH}
              nameDisabled={collection.isPublished}
              onCancel={onClose}
              onConfirm={confirmDetails}
            />
          ))}
        {step === 'items' && (
          <LinkedItemsStep
            collection={collection}
            itemsToPublish={itemsToPublish}
            itemsToPush={itemsToPush}
            isSigning={signCheque.isPending}
            signError={signCheque.isError}
            onBack={back}
            onConfirm={confirmItems}
          />
        )}
        {step === 'kind' && (
          <LinkedKindStep
            value={isProgrammatic}
            price={price.data}
            priceError={price.isError}
            onRetryPrice={() => void price.refetch()}
            onChange={setProgrammatic}
            onBack={back}
            onConfirm={forward}
          />
        )}
        {step === 'payment' && (
          <LinkedPaymentStep
            collection={collection}
            thirdParty={thirdParty}
            session={session}
            itemsToPublish={itemsToPublish}
            itemsToPush={itemsToPush}
            isProgrammatic={isProgrammatic}
            price={price.data}
            priceError={price.isError}
            onRetryPrice={() => void price.refetch()}
            availableSlots={slots.data}
            slotsError={slots.isError}
            onRetrySlots={() => void slots.refetch()}
            accepted={termsAccepted}
            onAcceptedChange={setTermsAccepted}
            onBack={back}
            onSubmit={() => void submit()}
          />
        )}
      </S.Main>
    </Modal>
  )
}

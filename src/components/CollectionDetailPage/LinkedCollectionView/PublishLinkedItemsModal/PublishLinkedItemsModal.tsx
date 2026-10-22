import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from '~/intl'
import { useSaveCollection } from '~/hooks/useCollection'
import { useLinkedSlots, usePublishLinkedItems, useSignSlotsCheque, useThirdPartyPrice } from '~/hooks/useLinkedPublish'
import { useProfile } from '~/hooks/useProfile'
import { useBeforeUnloadGuard } from '~/hooks/useBeforeUnloadGuard'
import { track } from '~/lib/analytics'
import { type Session } from '~/lib/auth'
import { type SlotsCheque } from '~/lib/builder'
import { type Collection } from '~/lib/collections'
import { type Item } from '~/lib/items'
import { type ItemCuration } from '~/lib/linkedItemStatus'
import { loadPendingPublish, savePendingPublish, type PendingPublish } from '~/lib/pendingLinkedPayment'
import { getMaticChainId } from '~/lib/publishCollection'
import {
  LinkedPublishError,
  getLinkedPublishQuote,
  mayHavePublished,
  type LinkedPublishStep,
  type LinkedSlots
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
  // What earlier attempts left behind: a payment a retry must resume from (kept across reopenings of the wizard), and
  // a publish request that may have landed.
  const pendingScope = useMemo(
    () => ({ chainId: getMaticChainId(), address, collectionId: collection.id }),
    [address, collection.id]
  )
  const [pending, setPending] = useState<PendingPublish>(() => loadPendingPublish(pendingScope))
  const pendingRef = useRef(pending)
  // Written to storage right away, not in a render: the run reports its payment even if the wizard is gone by then.
  const updatePending = useCallback(
    (patch: PendingPublish) => {
      const next = { ...pendingRef.current, ...patch }
      pendingRef.current = next
      savePendingPublish(pendingScope, next)
      setPending(next)
    },
    [pendingScope]
  )
  const paidTx = pending.payment
  // Set synchronously on Submit: a second click during the slots re-read must not start a second, paying run.
  const submitting = useRef(false)
  const [slotsError, setSlotsError] = useState(false)
  const [feeChanged, setFeeChanged] = useState(false)

  const profile = useProfile(address)
  const profileEmail = profile.data?.email?.trim() ?? ''
  const saveCollection = useSaveCollection(address)
  const signCheque = useSignSlotsCheque(session)
  const price = useThirdPartyPrice()
  const slots = useLinkedSlots(address, thirdParty.id)
  const publish = usePublishLinkedItems(session, collection)
  const isRunning = publish.isPending || runningStep !== null
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

  const quoteFor = (read: LinkedSlots) =>
    getLinkedPublishQuote(itemsToPublish.length, read, price.data!, {
      isProgrammatic,
      published: thirdParty.published
    })

  async function submit() {
    if (!price.data || !slots.data || submitting.current) return
    submitting.current = true
    const shown = quoteFor(slots.data)
    setSlotsError(false)
    setFeeChanged(false)
    setRunningStep('tos')
    // Read again right before paying: the slots an earlier attempt bought must not be bought twice. A failed read
    // hands back the stale count, so it stops here instead; and since the server also answers 0 when it fails, a 0 is
    // confirmed with a second read before it can lead to buying every slot again.
    let read = await slots.refetch()
    if (!read.isError && read.data?.available === 0) read = await slots.refetch()
    const fresh = read.isError ? undefined : read.data
    const stop = () => {
      submitting.current = false
      setRunningStep(null)
    }
    if (!fresh) {
      setSlotsError(true)
      return stop()
    }
    // Someone else used slots meanwhile: the creator confirms the higher fee first.
    if (quoteFor(fresh).fee.maxManaWei > shown.fee.maxManaWei) {
      setFeeChanged(true)
      return stop()
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
        slots: fresh,
        maxFeeManaWei: shown.fee.maxManaWei,
        price: price.data,
        paidTx,
        publishMayHaveLanded: !!pending.publishMayHaveLanded,
        curations,
        onStep: setRunningStep,
        onPayment: payment => updatePending({ payment })
      },
      {
        onSuccess: () => {
          updatePending({ payment: undefined, publishMayHaveLanded: false })
          setOutcome('success')
          onPublished()
        },
        onError: error => {
          const failure =
            error instanceof LinkedPublishError ? error : new LinkedPublishError('publish', 'generic', String(error))
          if (mayHavePublished(failure)) updatePending({ publishMayHaveLanded: true })
          setOutcome(failure)
        },
        onSettled: () => {
          submitting.current = false
          setRunningStep(null)
        }
      }
    )
  }

  if (outcome) {
    return (
      <LinkedPublishOutcomeModal
        outcome={outcome}
        onClose={onClose}
        onRetry={() => {
          setOutcome(null)
          // The server refusing the ToS most likely means the email: back to the first step.
          goTo(outcome !== 'success' && outcome.reason === 'tos_failed' ? 'name' : 'payment')
        }}
      />
    )
  }

  if (runningStep) {
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
            slots={slots.data}
            slotsError={slots.isError || slotsError}
            feeChanged={feeChanged}
            onRetrySlots={() => {
              setSlotsError(false)
              void slots.refetch()
            }}
            resuming={!!paidTx}
            busy={isRunning}
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

import { useCallback, useState } from 'react'
import { useTranslation } from '~/intl'
import { useAllCollectionItems, useSaveCollection } from '~/hooks/useCollection'
import { type Session } from '~/lib/auth'
import { type Collection } from '~/lib/collections'
import { type TopUpResume } from '~/lib/creditsTopUp'
import { type PaymentMethod, type PublishCollectionError, type PublishResult } from '~/lib/publishCollection'
import { Modal } from '~/components/Modal'
import { ConfirmItemsStep } from './ConfirmItemsStep'
import { ConfirmNameStep } from './ConfirmNameStep'
import { PaymentStep } from './PaymentStep'
import { PublishErrorModal } from './PublishErrorModal'
import { TopUpOutcome } from './TopUpOutcome'
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

type Props = {
  collection: Collection
  session: Session
  resume?: PublishResume
  onClose: () => void
  onPublished: (result: PublishResult) => void
}

/**
 * The three-step publish wizard: confirm name → review items → confirm & pay. A failed publish
 * swaps in the error dialog; TRY AGAIN comes back here on the payment step with everything kept.
 */
export function PublishCollectionModal({ collection, session, resume, onClose, onPublished }: Props) {
  const { t } = useTranslation()
  const { address } = session

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

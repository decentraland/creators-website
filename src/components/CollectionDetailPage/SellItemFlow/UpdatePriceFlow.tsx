import { useRef, useState } from 'react'
import { useTranslation } from '~/intl'
import { useBeforeUnloadGuard } from '~/hooks/useBeforeUnloadGuard'
import { useSellItem, useUpdatePrice } from '~/hooks/useSales'
import { isSocialLogin, type Session } from '~/lib/auth'
import { type Collection } from '~/lib/collections'
import { type Item } from '~/lib/items'
import { type ItemListing } from '~/lib/listings'
import { toSellItemError, type ListingTerms, type SellFailureReason } from '~/lib/sales'
import { PendingModal } from './PendingModal'
import { SaleErrorModal } from './SaleErrorModal'
import { SaleSuccessModal } from './SaleSuccessModal'
import { UpdatePriceModal } from './UpdatePriceModal'

type View = 'form' | 'signing' | 'storing' | 'success' | 'error'
// The two wallet prompts of a price change, then the order being stored.
type Step = 'cancel' | 'sign'

type Props = {
  item: Item
  collection: Collection
  listing: ItemListing & { tradeId: string }
  session: Session
  onClose: () => void
}

/**
 * Change a listing's price: the current order is cancelled on chain and a new one is signed with the
 * same beneficiary and expiration. Web3 wallets see the two signatures as steps; social login signs
 * silently and only sees "Updating price". Once the old order is gone, a retry re-lists directly.
 */
export function UpdatePriceFlow({ item, collection, listing, session, onClose }: Props) {
  const { t } = useTranslation()
  const social = isSocialLogin(session)

  const [view, setView] = useState<View>('form')
  const [step, setStep] = useState<Step>('cancel')
  const [reason, setReason] = useState<SellFailureReason>('generic')
  const [credits, setCredits] = useState('')
  // Set once the old listing is cancelled: from then on only the new order is missing. A ref, because
  // the mutation callbacks close over the render they were created in and nothing renders it.
  const terms = useRef<ListingTerms | null>(null)
  const attempt = useRef(0)

  const update = useUpdatePrice(session)
  const sell = useSellItem(session)
  useBeforeUnloadGuard(update.isPending || sell.isPending)

  function fail(cause: unknown) {
    const failure = toSellItemError(cause).reason
    // Rejecting the first prompt leaves the listing untouched, so the form comes back. Rejecting the
    // second one happens after the old order is already cancelled: the item is off sale, hence the error view.
    if (failure === 'rejected' && !terms.current) {
      setView('form')
      return
    }
    setReason(failure)
    setView('error')
  }

  function submit(value: number) {
    setCredits(String(value))
    const id = ++attempt.current
    const guard =
      <T,>(fn: (arg: T) => void) =>
      (arg: T) =>
        attempt.current === id && fn(arg)
    if (terms.current) {
      // The old order is already gone: only the new signature is left.
      setStep('sign')
      if (!social) setView('signing')
      sell.mutate(
        {
          collection,
          item,
          price: { kind: 'credits', credits: value },
          ...terms.current,
          onSigned: guard<void>(() => setView('storing'))
        },
        { onSuccess: guard(() => setView('success')), onError: guard(fail) }
      )
      return
    }
    setStep('cancel')
    setView(social ? 'storing' : 'signing')
    update.mutate(
      {
        collection,
        item,
        tradeId: listing.tradeId,
        credits: value,
        onSigned: guard(signed => {
          if (signed === 'cancel') setStep('sign')
          else setView('storing')
        }),
        onCancelled: guard((cancelled: ListingTerms) => {
          terms.current = cancelled
        })
      },
      { onSuccess: guard(() => setView('success')), onError: guard(fail) }
    )
  }

  function backOut() {
    attempt.current++
    setView('form')
  }

  const currentCredits = listing.currency === 'credits' ? listing.credits : null
  const steps = {
    labels: [t('sell_item_modal.update_price.step_remove'), t('sell_item_modal.update_price.step_confirm')],
    current: step === 'cancel' ? 1 : 2
  }

  switch (view) {
    case 'form':
      return (
        <UpdatePriceModal
          item={item}
          currentCredits={currentCredits}
          initialCredits={credits}
          onSubmit={submit}
          onClose={onClose}
        />
      )
    case 'signing':
      return (
        <PendingModal
          title={t('sell_item_modal.update_price.two_signatures')}
          steps={steps}
          label={t(
            step === 'cancel'
              ? 'sell_item_modal.update_price.confirm_removal'
              : 'sell_item_modal.update_price.confirm_new'
          )}
          // Only the first prompt can be walked away from: once the cancellation is signed, the listing is going.
          onCancel={step === 'cancel' ? backOut : undefined}
          testId="update-price-signing"
        />
      )
    case 'storing':
      return <PendingModal label={t('sell_item_modal.update_price.pending')} testId="update-price-pending" />
    case 'success':
      return (
        <SaleSuccessModal
          title={t('sell_item_modal.update_price.success_title')}
          description={t('sell_item_modal.update_price.success_description')}
          onDone={onClose}
        />
      )
    case 'error':
      return <SaleErrorModal stage="update" reason={reason} onCancel={onClose} onRetry={() => setView('form')} />
  }
}

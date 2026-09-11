import { useRef, useState } from 'react'
import { useTranslation } from '~/intl'
import { useBeforeUnloadGuard } from '~/hooks/useBeforeUnloadGuard'
import { useEnableSales, useSalesEnabled, useSellItem } from '~/hooks/useSales'
import { isSocialLogin, type Session } from '~/lib/auth'
import { type Collection } from '~/lib/collections'
import { type Item } from '~/lib/items'
import { toSellItemError, type SellFailureReason } from '~/lib/sales'
import { EnableSalesModal } from './EnableSalesModal'
import { PendingModal } from './PendingModal'
import { SaleErrorModal, type SaleStage } from './SaleErrorModal'
import { SaleSuccessModal } from './SaleSuccessModal'
import { DEFAULT_SELL_VALUES, SellItemModal, type SellFormValues, type SellSubmission } from './SellItemModal'

type View = 'enable' | 'enabling' | 'form' | 'selling' | 'success' | 'error'
// A wallet transaction/signature is first prompted, then (once signed) confirmed or stored.
type Phase = 'confirm' | 'pending'

type Props = {
  item: Item
  collection: Collection
  session: Session
  /** The item was edited after its approval: buyers get the approved version until the changes are approved. */
  hasPendingChanges?: boolean
  onClose: () => void
}

/**
 * Put an item on sale: enable sales on the collection the first time (one transaction), then sign the
 * item's order. Web3 wallets get a whole-dialog "confirm in your wallet" status with a way out while the
 * prompt is open; custodial (social login) wallets sign silently, so their submit button just spins.
 */
export function SellItemFlow({ item, collection, session, hasPendingChanges = false, onClose }: Props) {
  const { t } = useTranslation()
  const social = isSocialLogin(session)
  const salesEnabled = useSalesEnabled(collection)

  const [view, setView] = useState<View>(salesEnabled ? 'form' : 'enable')
  const [phase, setPhase] = useState<Phase>('confirm')
  const [error, setError] = useState<{ stage: SaleStage; reason: SellFailureReason } | null>(null)
  const [values, setValues] = useState<SellFormValues>(DEFAULT_SELL_VALUES)
  // Bumped when the creator backs out of a wallet prompt, so that attempt's outcome is ignored.
  const attempt = useRef(0)

  const enableSales = useEnableSales(session)
  const sell = useSellItem(session)
  useBeforeUnloadGuard(enableSales.isPending || sell.isPending)

  function fail(stage: SaleStage, cause: unknown, backTo: View) {
    const reason = toSellItemError(cause).reason
    // Dismissing the wallet prompt is the creator changing their mind, not a failure to report.
    if (reason === 'rejected') {
      setView(backTo)
      return
    }
    setError({ stage, reason })
    setView('error')
  }

  function startEnable() {
    const id = ++attempt.current
    setPhase('confirm')
    if (!social) setView('enabling')
    enableSales.mutate(
      { collection, onSigned: () => attempt.current === id && setPhase('pending') },
      {
        onSuccess: () => attempt.current === id && setView('form'),
        onError: cause => attempt.current === id && fail('enable', cause, 'enable')
      }
    )
  }

  function submitSell(formValues: SellFormValues, submission: SellSubmission) {
    setValues(formValues)
    const id = ++attempt.current
    setPhase('confirm')
    if (!social) setView('selling')
    sell.mutate(
      { collection, item, ...submission, onSigned: () => attempt.current === id && setPhase('pending') },
      {
        onSuccess: () => attempt.current === id && setView('success'),
        onError: cause => attempt.current === id && fail('sell', cause, 'form')
      }
    )
  }

  function backOut(to: View) {
    attempt.current++
    setView(to)
  }

  switch (view) {
    case 'enable':
      return (
        <EnableSalesModal
          isOwner={collection.owner.toLowerCase() === session.address.toLowerCase()}
          busy={social && enableSales.isPending}
          onCancel={onClose}
          onConfirm={startEnable}
        />
      )
    case 'enabling':
      return (
        <PendingModal
          label={
            phase === 'confirm' ? t('sell_item_modal.confirm_in_wallet') : t('sell_item_modal.enable_sales.pending')
          }
          onCancel={phase === 'confirm' ? () => backOut('enable') : undefined}
          testId="enable-sales-pending"
        />
      )
    case 'form':
      return (
        <SellItemModal
          item={item}
          session={session}
          initialValues={values}
          hasPendingChanges={hasPendingChanges}
          busy={social && sell.isPending}
          onSubmit={submitSell}
          onClose={onClose}
        />
      )
    case 'selling':
      return (
        <PendingModal
          label={phase === 'confirm' ? t('sell_item_modal.confirm_in_wallet') : t('sell_item_modal.selling')}
          onCancel={phase === 'confirm' ? () => backOut('form') : undefined}
          testId="sell-item-pending"
        />
      )
    case 'success':
      return (
        <SaleSuccessModal
          title={t('sell_item_modal.success.title')}
          description={t('sell_item_modal.success.description')}
          onDone={onClose}
        />
      )
    case 'error':
      return error ? (
        <SaleErrorModal
          stage={error.stage}
          reason={error.reason}
          onCancel={onClose}
          onRetry={() => {
            setError(null)
            setView(error.stage === 'enable' ? 'enable' : 'form')
          }}
        />
      ) : null
  }
}

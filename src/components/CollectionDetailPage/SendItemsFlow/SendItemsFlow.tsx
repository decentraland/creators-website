import { useMemo, useRef, useState } from 'react'
import { useTranslation } from '~/intl'
import sentArt from '~/assets/send-success.png'
import { useBeforeUnloadGuard } from '~/hooks/useBeforeUnloadGuard'
import { useSendItems } from '~/hooks/useSales'
import { isSocialLogin, type Session } from '~/lib/auth'
import { type Collection } from '~/lib/collections'
import { type Item } from '~/lib/items'
import { createTransfer, isSendableItem, type TransferDraft } from '~/lib/mint'
import { toSellItemError, type SellFailureReason } from '~/lib/sales'
import { PendingModal } from '../SellItemFlow/PendingModal'
import { SaleErrorModal } from '../SellItemFlow/SaleErrorModal'
import { SaleSuccessModal } from '../SellItemFlow/SaleSuccessModal'
import { SendItemsModal, type SendStep } from './SendItemsModal'

type View = 'form' | 'sending' | 'success' | 'error'
type Phase = 'confirm' | 'pending'

type Props = {
  collection: Collection
  items: Item[]
  session: Session
  onClose: () => void
}

/**
 * Send copies of the collection's items straight to wallets. Same shape as SellItemFlow: web3 wallets get
 * the whole-dialog "confirm in your wallet" status, custodial ones just see the submit button spin; a
 * failure's TRY AGAIN reopens the confirm step with everything kept.
 */
export function SendItemsFlow({ collection, items, session, onClose }: Props) {
  const { t } = useTranslation()
  const social = isSocialLogin(session)
  const sendable = useMemo(() => items.filter(isSendableItem), [items])

  const [view, setView] = useState<View>('form')
  const [phase, setPhase] = useState<Phase>('confirm')
  const [step, setStep] = useState<SendStep>('select')
  const [transfers, setTransfers] = useState<TransferDraft[]>(() => [createTransfer()])
  const [reason, setReason] = useState<SellFailureReason | null>(null)
  // Bumped when the creator backs out of a wallet prompt, so that attempt's outcome is ignored.
  const attempt = useRef(0)

  const send = useSendItems(session)
  useBeforeUnloadGuard(send.isPending)

  function submit() {
    const id = ++attempt.current
    setPhase('confirm')
    if (!social) setView('sending')
    send.mutate(
      { collection, items: sendable, transfers, onSigned: () => attempt.current === id && setPhase('pending') },
      {
        onSuccess: () => attempt.current === id && setView('success'),
        onError: cause => {
          if (attempt.current !== id) return
          const failure = toSellItemError(cause).reason
          // Dismissing the wallet prompt is the creator changing their mind, not a failure to report.
          if (failure === 'rejected') return setView('form')
          setReason(failure)
          setView('error')
        }
      }
    )
  }

  switch (view) {
    case 'form':
      return (
        <SendItemsModal
          items={sendable}
          session={session}
          step={step}
          transfers={transfers}
          onStep={setStep}
          onTransfers={setTransfers}
          busy={social && send.isPending}
          onSubmit={submit}
          onClose={onClose}
        />
      )
    case 'sending':
      return (
        <PendingModal
          label={phase === 'confirm' ? t('sell_item_modal.confirm_in_wallet') : t('send_items_modal.sending')}
          onCancel={
            phase === 'confirm'
              ? () => {
                  attempt.current++
                  setView('form')
                }
              : undefined
          }
          testId="send-items-pending"
        />
      )
    case 'success':
      return (
        <SaleSuccessModal
          title={t('send_items_modal.success_title')}
          description={t('send_items_modal.success_description')}
          art={sentArt}
          onDone={onClose}
        />
      )
    case 'error':
      return reason ? (
        <SaleErrorModal
          stage="send"
          reason={reason}
          onCancel={onClose}
          onRetry={() => {
            setReason(null)
            setView('form')
          }}
        />
      ) : null
  }
}

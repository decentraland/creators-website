import { useEffect, useRef, useState } from 'react'
import { useTranslation } from '~/intl'
import { useBeforeUnloadGuard } from '~/hooks/useBeforeUnloadGuard'
import { useTransferCollectionOwnership } from '~/hooks/useTransferCollectionOwnership'
import { useFriends } from '~/hooks/useSales'
import { shortenAddress } from '~/lib/address'
import { isSocialLogin, type Session } from '~/lib/auth'
import { installBackGuard } from '~/lib/backGuard'
import { type Collection } from '~/lib/collections'
import { matchesCollectionName } from '~/lib/collectionOwnership'
import { toSellItemError, type SellFailureReason } from '~/lib/sales'
import { PendingModal } from '../SellItemFlow/PendingModal'
import { SaleErrorModal } from '../SellItemFlow/SaleErrorModal'
import { SaleSuccessModal } from '../SellItemFlow/SaleSuccessModal'
import { ConfirmModal } from '~/components/ConfirmModal'
import { TransferOwnershipModal } from './TransferOwnershipModal'

type View = 'form' | 'saving' | 'success' | 'error'
type Phase = 'confirm' | 'pending'

type Props = {
  collection: Collection
  session: Session
  /** The transfer is done and acknowledged: the collection is no longer the signer's. */
  onDone: () => void
  onClose: () => void
}

/**
 * Hand the collection to another wallet. The form asks for the new owner and the collection's name as
 * confirmation; TRANSFER OWNERSHIP sends `transferCreatorship` in one transaction: web3 wallets get the
 * whole-dialog "confirm in your wallet" status, custodial ones just see the button spin. Closing with
 * anything filled in asks first.
 */
export function TransferOwnershipFlow({ collection, session, onDone, onClose }: Props) {
  const { t } = useTranslation()
  const social = isSocialLogin(session)
  const friends = useFriends(session, true)

  const [view, setView] = useState<View>('form')
  const [phase, setPhase] = useState<Phase>('confirm')
  const [newOwner, setNewOwner] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [isDiscardOpen, setDiscardOpen] = useState(false)
  const [reason, setReason] = useState<SellFailureReason | null>(null)
  // Bumped when the creator backs out of a wallet prompt, so that attempt's outcome is ignored.
  const attempt = useRef(0)

  const transfer = useTransferCollectionOwnership(session)
  const dirty = newOwner !== '' || confirmation !== ''
  const ready = newOwner !== '' && matchesCollectionName(collection, confirmation)
  const busy = social && transfer.isPending
  useBeforeUnloadGuard(dirty || transfer.isPending)

  function requestClose() {
    if (busy || isDiscardOpen) return
    if (dirty) setDiscardOpen(true)
    else onClose()
  }

  // Browser back would silently unmount the dialog; the guard absorbs it and asks about the filled-in form instead.
  const requestCloseRef = useRef(requestClose)
  requestCloseRef.current = requestClose
  useEffect(() => installBackGuard(() => requestCloseRef.current()), [])

  function submit() {
    const id = ++attempt.current
    setPhase('confirm')
    if (!social) setView('saving')
    transfer.mutate(
      { collection, newOwner, onSigned: () => attempt.current === id && setPhase('pending') },
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
        <>
          <TransferOwnershipModal
            collection={collection}
            newOwner={newOwner}
            confirmation={confirmation}
            friends={friends.data}
            isLoadingFriends={friends.isLoading}
            busy={busy}
            canSubmit={ready && !transfer.isPending}
            onNewOwnerChange={setNewOwner}
            onConfirmationChange={setConfirmation}
            onSubmit={submit}
            onClose={requestClose}
          />
          {isDiscardOpen && (
            <ConfirmModal
              title={t('transfer_ownership_modal.discard.title')}
              description={t('transfer_ownership_modal.discard.description')}
              onClose={() => setDiscardOpen(false)}
              cancel={{
                label: t('transfer_ownership_modal.discard.leave'),
                onClick: onClose,
                testId: 'discard-transfer-leave'
              }}
              confirm={{
                label: t('transfer_ownership_modal.discard.keep'),
                onClick: () => setDiscardOpen(false),
                testId: 'discard-transfer-keep'
              }}
              testId="discard-transfer-modal"
            />
          )}
        </>
      )
    case 'saving':
      return (
        <PendingModal
          label={phase === 'confirm' ? t('sell_item_modal.confirm_in_wallet') : t('transfer_ownership_modal.saving')}
          onCancel={
            phase === 'confirm'
              ? () => {
                  attempt.current++
                  setView('form')
                }
              : undefined
          }
          testId="transfer-ownership-pending"
        />
      )
    case 'success':
      return (
        <SaleSuccessModal
          title={t('transfer_ownership_modal.success_title')}
          description={t('transfer_ownership_modal.success_description', {
            name: collection.name,
            owner: shortenAddress(newOwner)
          })}
          onDone={onDone}
        />
      )
    case 'error':
      return reason ? (
        <SaleErrorModal
          stage="transfer"
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

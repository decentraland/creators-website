import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from '~/intl'
import { useBeforeUnloadGuard } from '~/hooks/useBeforeUnloadGuard'
import { useRoleAddresses, useSetCollectionRoles } from '~/hooks/useCollectionRoles'
import { useFriends } from '~/hooks/useSales'
import { isSocialLogin, type Session } from '~/lib/auth'
import { installBackGuard } from '~/lib/backGuard'
import { type Collection } from '~/lib/collections'
import { diffRoles, type RoleKind } from '~/lib/collectionRoles'
import { toSellItemError, type SellFailureReason } from '~/lib/sales'
import { PendingModal } from '../SellItemFlow/PendingModal'
import { SaleErrorModal } from '../SellItemFlow/SaleErrorModal'
import { SaleSuccessModal } from '../SellItemFlow/SaleSuccessModal'
import { ConfirmModal } from '~/components/ConfirmModal'
import { ManageRolesModal } from './ManageRolesModal'
import { RemoveRoleModal } from './RemoveRoleModal'

type View = 'form' | 'saving' | 'success' | 'error'
type Phase = 'confirm' | 'pending'

type Props = {
  collection: Collection
  kind: RoleKind
  session: Session
  onClose: () => void
}

/**
 * Edit who may send the collection's items (senders) or change them (collaborators). The list is a draft
 * until SAVE CHANGES sends the diff in one transaction: web3 wallets get the whole-dialog "confirm in your
 * wallet" status, custodial ones just see the button spin. Closing with unsaved changes asks first.
 */
export function ManageRolesFlow({ collection, kind, session, onClose }: Props) {
  const { t } = useTranslation()
  const social = isSocialLogin(session)
  const current = useRoleAddresses(collection, kind)
  const friends = useFriends(session, true)

  const [view, setView] = useState<View>('form')
  const [phase, setPhase] = useState<Phase>('confirm')
  const [addresses, setAddresses] = useState(current)
  const [removing, setRemoving] = useState<string | null>(null)
  const [isDiscardOpen, setDiscardOpen] = useState(false)
  const [reason, setReason] = useState<SellFailureReason | null>(null)
  // Bumped when the creator backs out of a wallet prompt, so that attempt's outcome is ignored.
  const attempt = useRef(0)

  const save = useSetCollectionRoles(session)
  const dirty = useMemo(() => diffRoles(current, addresses).addresses.length > 0, [current, addresses])
  const busy = social && save.isPending
  useBeforeUnloadGuard(dirty || save.isPending)

  function requestClose() {
    if (busy || removing || isDiscardOpen) return
    if (dirty) setDiscardOpen(true)
    else onClose()
  }

  // Browser back would silently unmount the dialog; the guard absorbs it and asks about unsaved changes instead.
  const requestCloseRef = useRef(requestClose)
  requestCloseRef.current = requestClose
  useEffect(() => installBackGuard(() => requestCloseRef.current()), [])

  function submit() {
    const id = ++attempt.current
    setPhase('confirm')
    if (!social) setView('saving')
    save.mutate(
      { collection, kind, current, next: addresses, onSigned: () => attempt.current === id && setPhase('pending') },
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
          <ManageRolesModal
            collection={collection}
            kind={kind}
            addresses={addresses}
            friends={friends.data}
            isLoadingFriends={friends.isLoading}
            busy={busy}
            canSave={dirty && !save.isPending}
            onAdd={address => setAddresses(list => [...list, address])}
            onRemove={setRemoving}
            onSubmit={submit}
            onClose={requestClose}
          />
          {removing && (
            <RemoveRoleModal
              kind={kind}
              address={removing}
              friends={friends.data}
              onConfirm={() => {
                setAddresses(list => list.filter(address => address !== removing))
                setRemoving(null)
              }}
              onCancel={() => setRemoving(null)}
            />
          )}
          {isDiscardOpen && (
            <ConfirmModal
              title={t('manage_roles_modal.discard.title')}
              description={t('manage_roles_modal.discard.description')}
              onClose={() => setDiscardOpen(false)}
              cancel={{ label: t('manage_roles_modal.discard.leave'), onClick: onClose, testId: 'discard-roles-leave' }}
              confirm={{
                label: t('manage_roles_modal.discard.keep'),
                onClick: () => setDiscardOpen(false),
                testId: 'discard-roles-keep'
              }}
              testId="discard-roles-modal"
            />
          )}
        </>
      )
    case 'saving':
      return (
        <PendingModal
          label={phase === 'confirm' ? t('sell_item_modal.confirm_in_wallet') : t('manage_roles_modal.saving')}
          onCancel={
            phase === 'confirm'
              ? () => {
                  attempt.current++
                  setView('form')
                }
              : undefined
          }
          testId="manage-roles-pending"
        />
      )
    case 'success':
      return (
        <SaleSuccessModal
          title={t(`manage_roles_modal.${kind}.success_title`)}
          description={t(`manage_roles_modal.${kind}.success_description`)}
          onDone={onClose}
        />
      )
    case 'error':
      return reason ? (
        <SaleErrorModal
          stage={kind}
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

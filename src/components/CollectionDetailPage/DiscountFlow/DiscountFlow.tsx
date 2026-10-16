import { useRef, useState } from 'react'
import errorArt from '~/assets/modal-error.png'
import { useTranslation } from '~/intl'
import { useBeforeUnloadGuard } from '~/hooks/useBeforeUnloadGuard'
import { lastCreatedDiscount, useCreateDiscount, useDiscountInFlight } from '~/hooks/useCollectionDiscounts'
import { isSocialLogin, type Session } from '~/lib/auth'
import { type DiscountReach } from '~/lib/collectionDiscount'
import { type Collection } from '~/lib/collections'
import { toDiscountError, type DiscountFailureReason } from '~/lib/coupons'
import { ConfirmModal } from '~/components/ConfirmModal'
import { PendingModal } from '~/components/PendingModal'
import { SuccessModal } from '~/components/SuccessModal'
import {
  CreateDiscountModal,
  defaultDiscountValues,
  type DiscountFormValues,
  type DiscountSubmission
} from './CreateDiscountModal'

type View = 'form' | 'signing' | 'success' | 'error'

type Props = {
  collection: Collection
  session: Session
  reach: DiscountReach
  manaListings: boolean
  onClose: () => void
}

/**
 * Create a discount over the collection: one wallet signature, no transaction and no fee. Web3 wallets get a
 * "confirm in your wallet" dialog with a way out while the prompt is open; social logins sign silently.
 */
export function DiscountFlow({ collection, session, reach, manaListings, onClose }: Props) {
  const { t } = useTranslation()
  const social = isSocialLogin(session)
  const create = useCreateDiscount(session)
  const { creating } = useDiscountInFlight({ collectionId: collection.id })
  const [view, setView] = useState<View>('form')
  const [phase, setPhase] = useState<'confirm' | 'pending'>('confirm')
  const [failure, setFailure] = useState<DiscountFailureReason>('generic')
  const [values, setValues] = useState<DiscountFormValues>(() => defaultDiscountValues())
  // Bumped when the creator backs out of the wallet prompt, so that attempt's outcome is ignored.
  const attempt = useRef(0)
  // A create from a dialog the creator closed counts too: while it posts, and once it went through.
  useBeforeUnloadGuard(creating)
  const createdAtOpen = useRef(lastCreatedDiscount(collection.id))
  const createdMeanwhile = lastCreatedDiscount(collection.id) !== createdAtOpen.current

  function submit(formValues: DiscountFormValues, submission: DiscountSubmission) {
    setValues(formValues)
    const id = ++attempt.current
    setPhase('confirm')
    if (!social) setView('signing')
    create.mutate(
      {
        collection,
        ...submission,
        discountedCount: reach.discounted,
        onSigned: () => attempt.current === id && setPhase('pending')
      },
      {
        // Even an attempt the creator backed out of is live once signed: say so rather than offer a second one.
        onSuccess: () => setView('success'),
        onError: cause => {
          if (attempt.current !== id) return
          // Dismissing the wallet prompt is the creator changing their mind, not a failure.
          if (toDiscountError(cause).reason === 'rejected') {
            setView('form')
            return
          }
          setFailure(toDiscountError(cause).reason)
          setView('error')
        }
      }
    )
  }

  switch (view === 'form' && createdMeanwhile ? 'success' : view) {
    case 'form':
      return (
        <CreateDiscountModal
          collectionName={collection.name}
          reach={reach}
          manaListings={manaListings}
          initialValues={values}
          // Also while a prompt the creator backed out of is still open, so it can't be signed twice.
          busy={creating}
          // A social login signs without a prompt to back out of; anyone else can close while a stale one is open.
          closeLocked={social && creating}
          canEndEarly={!social}
          onSubmit={submit}
          onClose={onClose}
        />
      )
    case 'signing':
      return (
        <PendingModal
          label={phase === 'confirm' ? t('collection_discount.confirm_in_wallet') : t('collection_discount.saving')}
          onCancel={
            phase === 'confirm'
              ? () => {
                  attempt.current++
                  setView('form')
                }
              : undefined
          }
          testId="create-discount-pending"
        />
      )
    case 'success':
      return (
        <SuccessModal
          title={t('collection_discount.success.title')}
          description={t(
            social ? 'collection_discount.success.description_social' : 'collection_discount.success.description'
          )}
          onDone={onClose}
        />
      )
    case 'error':
      return (
        <ConfirmModal
          title={t('collection_discount.error.title')}
          description={t(
            failure === 'wallet'
              ? 'collection_discount.error.description_wallet'
              : 'collection_discount.error.description'
          )}
          art={{ src: errorArt }}
          onClose={onClose}
          cancel={{ label: t('collection_discount.cancel'), onClick: onClose, testId: 'discount-error-cancel' }}
          confirm={{
            label: t('collection_discount.error.try_again'),
            onClick: () => setView('form'),
            testId: 'discount-error-retry'
          }}
          testId="discount-error-modal"
        />
      )
  }
}

import { useRef, useState } from 'react'
import errorArt from '~/assets/modal-error.png'
import { useTranslation } from '~/intl'
import { useBeforeUnloadGuard } from '~/hooks/useBeforeUnloadGuard'
import { useEndDiscount } from '~/hooks/useCollectionDiscounts'
import { isSocialLogin, type Session } from '~/lib/auth'
import { type Collection } from '~/lib/collections'
import { discountPct, toDiscountError, type CollectionDiscount } from '~/lib/coupons'
import { captureError } from '~/lib/monitoring'
import { ConfirmModal } from '~/components/ConfirmModal'
import { PendingModal } from '~/components/PendingModal'
import { SuccessModal } from '~/components/SuccessModal'

type View = 'confirm' | 'pending' | 'success' | 'error' | 'slow'

type Props = {
  discount: CollectionDiscount
  collection: Collection
  session: Session
  onClose: () => void
}

/** End a discount early: confirm, cancel the coupon from the wallet on Polygon (it pays the gas), celebrate. */
export function EndDiscountFlow({ discount, collection, session, onClose }: Props) {
  const { t } = useTranslation()
  const social = isSocialLogin(session)
  const end = useEndDiscount(session)
  const [view, setView] = useState<View>('confirm')
  const [phase, setPhase] = useState<'confirm' | 'mining'>('confirm')
  const attempt = useRef(0)
  useBeforeUnloadGuard(end.isPending)

  function start() {
    // A prompt the creator backed out of may still be open: a second one would be a second paid cancellation.
    if (end.isPending) return
    const id = ++attempt.current
    setPhase('confirm')
    setView('pending')
    end.mutate(
      { discount, collection, onSigned: () => attempt.current === id && setPhase('mining') },
      {
        onSuccess: () => setView('success'),
        onError: cause => {
          if (attempt.current !== id) return
          const reason = toDiscountError(cause).reason
          if (reason === 'rejected') {
            setView('confirm')
            return
          }
          // Sent, just not mined yet: offering a retry would pay for a second cancellation.
          if (reason === 'pending') {
            setView('slow')
            return
          }
          captureError(cause, { flow: 'end_collection_discount', collectionId: collection.id, discountId: discount.id })
          setView('error')
        }
      }
    )
  }

  // A social login's wallet can't move to Polygon or pay its gas, so the discount runs until its date.
  if (social) {
    return (
      <ConfirmModal
        title={t('collection_discount.end.title')}
        description={t('collection_discount.end.social_description')}
        onClose={onClose}
        cancel={{ label: t('collection_discount.end.close'), onClick: onClose, testId: 'end-discount-cancel' }}
        testId="end-discount-modal"
      />
    )
  }

  switch (view) {
    case 'confirm':
      return (
        <ConfirmModal
          title={t('collection_discount.end.title')}
          description={t(
            discount.collections.length > 1
              ? 'collection_discount.end.description_multi'
              : 'collection_discount.end.description',
            { pct: discountPct(discount), others: discount.collections.length - 1 }
          )}
          onClose={onClose}
          cancel={{ label: t('collection_discount.cancel'), onClick: onClose, testId: 'end-discount-cancel' }}
          confirm={{ label: t('collection_discount.end.confirm'), onClick: start, testId: 'end-discount-confirm' }}
          testId="end-discount-modal"
        />
      )
    case 'pending':
      return (
        <PendingModal
          label={t(phase === 'confirm' ? 'collection_discount.confirm_in_wallet' : 'collection_discount.end.pending')}
          onCancel={
            phase === 'confirm'
              ? () => {
                  attempt.current++
                  setView('confirm')
                }
              : undefined
          }
          testId="end-discount-pending"
        />
      )
    case 'success':
      return (
        <SuccessModal
          title={t('collection_discount.end.success_title')}
          description={t('collection_discount.end.success_description')}
          onDone={onClose}
        />
      )
    case 'slow':
      return (
        <ConfirmModal
          title={t('collection_discount.end.slow_title')}
          description={t('collection_discount.end.slow_description')}
          onClose={onClose}
          cancel={{ label: t('collection_discount.end.close'), onClick: onClose, testId: 'end-discount-slow-close' }}
          testId="end-discount-slow-modal"
        />
      )
    case 'error':
      return (
        <ConfirmModal
          title={t('collection_discount.end.error_title')}
          description={t('collection_discount.end.error_description')}
          art={{ src: errorArt }}
          onClose={onClose}
          cancel={{ label: t('collection_discount.cancel'), onClick: onClose, testId: 'end-discount-error-cancel' }}
          confirm={{
            label: t('collection_discount.error.try_again'),
            onClick: () => setView('confirm'),
            testId: 'end-discount-error-retry'
          }}
          testId="end-discount-error-modal"
        />
      )
  }
}

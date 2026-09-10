import enableSalesArt from '~/assets/enable-sales.png'
import { ConfirmModal } from '~/components/ConfirmModal'
import { useTranslation } from '~/intl'

type Props = {
  /** Only the collection's creator may change its minters on chain; collaborators and minters see why. */
  isOwner: boolean
  /** The transaction is being signed by a custodial wallet, with no prompt to wait for. */
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}

/** First sale of a collection: the off-chain marketplace must be allowed to mint its items. */
export function EnableSalesModal({ isOwner, busy, onCancel, onConfirm }: Props) {
  const { t } = useTranslation()
  return (
    <ConfirmModal
      title={t('sell_item_modal.enable_sales.title')}
      description={t(isOwner ? 'sell_item_modal.enable_sales.description' : 'sell_item_modal.enable_sales.owner_only')}
      art={{ src: enableSalesArt }}
      busy={busy}
      onClose={onCancel}
      cancel={{ label: t('sell_item_modal.cancel'), onClick: onCancel, testId: 'enable-sales-cancel' }}
      confirm={
        isOwner
          ? { label: t('sell_item_modal.enable_sales.confirm'), onClick: onConfirm, testId: 'enable-sales-confirm' }
          : undefined
      }
      testId="enable-sales-modal"
    />
  )
}

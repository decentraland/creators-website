import { WarningAmberOutlined as WarningIcon } from '@mui/icons-material'
import { useTranslation } from '~/intl'
import { type Collection } from '~/lib/collections'
import { getNewOwnerError } from '~/lib/collectionOwnership'
import { type Friend } from '~/lib/friends'
import { Button } from '~/components/Button'
import { Modal } from '~/components/Modal'
import { BeneficiaryInput } from '../SellItemFlow/BeneficiaryInput'
import * as Sell from '../SellItemFlow/SellItemModal.styles'
import * as S from './TransferOwnershipModal.styles'

type Props = {
  collection: Collection
  /** The chosen new owner (lowercased), or '' while none is chosen. */
  newOwner: string
  /** What was typed to confirm; must match the collection's name. */
  confirmation: string
  friends: Friend[] | undefined
  isLoadingFriends: boolean
  /** A submit is in flight (custodial wallet, no prompt to wait for): the button spins. */
  busy: boolean
  canSubmit: boolean
  onNewOwnerChange: (address: string) => void
  onConfirmationChange: (value: string) => void
  onSubmit: () => void
  onClose: () => void
}

/** Pick the new owner, type the collection's name to confirm, TRANSFER OWNERSHIP once both are in. */
export function TransferOwnershipModal({
  collection,
  newOwner,
  confirmation,
  friends,
  isLoadingFriends,
  busy,
  canSubmit,
  onNewOwnerChange,
  onConfirmationChange,
  onSubmit,
  onClose
}: Props) {
  const { t } = useTranslation()

  function rejection(address: string): string | null {
    const error = getNewOwnerError(collection, address)
    return error ? t(`transfer_ownership_modal.${error}`) : null
  }

  return (
    <Modal
      title={t('transfer_ownership_modal.title')}
      onClose={onClose}
      closeDisabled={busy}
      compact
      testId="transfer-ownership-modal"
    >
      <Sell.Divider />
      <S.Body data-busy={busy || undefined} aria-busy={busy || undefined} {...(busy ? { inert: '' } : {})}>
        <S.Description data-testid="transfer-ownership-description">
          {t('transfer_ownership_modal.description', { name: collection.name })}
        </S.Description>
        <S.Note data-variant="warning" data-testid="transfer-ownership-warning">
          <WarningIcon aria-hidden />
          <p>{t('transfer_ownership_modal.warning')}</p>
        </S.Note>
        <S.Field>
          <S.Label>{t('transfer_ownership_modal.new_owner')}</S.Label>
          <BeneficiaryInput
            value={newOwner}
            onChange={onNewOwnerChange}
            friends={friends}
            isLoadingFriends={isLoadingFriends}
            placeholder={t('transfer_ownership_modal.placeholder')}
            duplicateError={rejection}
            clearLabel={t('transfer_ownership_modal.clear')}
            testId="new-owner"
          />
        </S.Field>
        <S.Field>
          <S.Label>{t('transfer_ownership_modal.confirm_label', { name: collection.name })}</S.Label>
          <S.Box>
            <input
              value={confirmation}
              placeholder={collection.name}
              autoComplete="off"
              spellCheck={false}
              data-testid="transfer-confirmation-input"
              onChange={event => onConfirmationChange(event.target.value)}
            />
          </S.Box>
        </S.Field>
      </S.Body>

      <Sell.Footer>
        <Button type="button" variant="secondary" disabled={busy} data-testid="transfer-cancel" onClick={onClose}>
          {t('sell_item_modal.cancel')}
        </Button>
        <Button
          type="button"
          variant="primary"
          disabled={!canSubmit}
          loading={busy}
          data-testid="transfer-submit"
          onClick={onSubmit}
        >
          {t('transfer_ownership_modal.submit')}
        </Button>
      </Sell.Footer>
    </Modal>
  )
}

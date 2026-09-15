import { useState } from 'react'
import { Add as AddIcon } from '@mui/icons-material'
import { useTranslation } from '~/intl'
import { type Collection } from '~/lib/collections'
import { getRoleAddressError, type RoleKind } from '~/lib/collectionRoles'
import { type Friend } from '~/lib/friends'
import { getMaticChainId } from '~/lib/publishCollection'
import { Button } from '~/components/Button'
import { Modal } from '~/components/Modal'
import { BeneficiaryInput } from '../SellItemFlow/BeneficiaryInput'
import * as Sell from '../SellItemFlow/SellItemModal.styles'
import * as S from './ManageRolesModal.styles'

type Props = {
  collection: Collection
  kind: RoleKind
  /** The draft list, lowercased. */
  addresses: string[]
  friends: Friend[] | undefined
  isLoadingFriends: boolean
  /** A submit is in flight (custodial wallet, no prompt to wait for): the button spins. */
  busy: boolean
  canSave: boolean
  onAdd: (address: string) => void
  /** Asks to drop an address; the flow confirms before it leaves the draft. */
  onRemove: (address: string) => void
  onSubmit: () => void
  onClose: () => void
}

/** The role's address list: one chip per holder, a picker row to add another, SAVE CHANGES once the list differs. */
export function ManageRolesModal({
  collection,
  kind,
  addresses,
  friends,
  isLoadingFriends,
  busy,
  canSave,
  onAdd,
  onRemove,
  onSubmit,
  onClose
}: Props) {
  const { t } = useTranslation()
  const [adding, setAdding] = useState(false)
  const showInput = addresses.length === 0 || adding

  function rejection(address: string): string | null {
    const error = getRoleAddressError(collection, kind, addresses, address, getMaticChainId())
    return error ? t(`manage_roles_modal.${error}`) : null
  }

  return (
    <Modal
      title={t(`manage_roles_modal.${kind}.title`)}
      onClose={onClose}
      closeDisabled={busy}
      testId="manage-roles-modal"
    >
      <Sell.Divider />
      <S.Body data-busy={busy || undefined} aria-busy={busy || undefined} {...(busy ? { inert: '' } : {})}>
        <S.Description data-testid="manage-roles-description">
          {t(`manage_roles_modal.${kind}.description`)}
        </S.Description>
        <S.List>
          {addresses.map((address, index) => (
            <S.Row key={address} data-testid="role-row">
              <BeneficiaryInput
                value={address}
                onChange={() => onRemove(address)}
                friends={friends}
                isLoadingFriends={isLoadingFriends}
                clearLabel={t(`manage_roles_modal.${kind}.remove`)}
                variant="compact"
                testId={`role-${index + 1}`}
              />
            </S.Row>
          ))}
          {showInput && (
            <S.Row>
              <BeneficiaryInput
                value=""
                onChange={address => {
                  onAdd(address)
                  setAdding(false)
                }}
                friends={friends}
                isLoadingFriends={isLoadingFriends}
                placeholder={t(`manage_roles_modal.${kind}.placeholder`)}
                duplicateError={rejection}
                testId="role-new"
              />
            </S.Row>
          )}
        </S.List>
        <S.LinkButton type="button" disabled={showInput} data-testid="role-add" onClick={() => setAdding(true)}>
          <AddIcon />
          {t(`manage_roles_modal.${kind}.add`)}
        </S.LinkButton>
      </S.Body>

      <Sell.Footer>
        <Button type="button" variant="secondary" disabled={busy} data-testid="role-cancel" onClick={onClose}>
          {t('sell_item_modal.cancel')}
        </Button>
        <Button
          type="button"
          variant="primary"
          disabled={!canSave}
          loading={busy}
          data-testid="role-save"
          onClick={onSubmit}
        >
          {t('manage_roles_modal.save')}
        </Button>
      </Sell.Footer>
    </Modal>
  )
}

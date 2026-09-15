import { useMemo } from 'react'
import { useTranslation } from '~/intl'
import { useProfile } from '~/hooks/useProfile'
import { type RoleKind } from '~/lib/collectionRoles'
import { type Friend } from '~/lib/friends'
import { ConfirmModal } from '~/components/ConfirmModal'

type Props = {
  kind: RoleKind
  address: string
  friends: Friend[] | undefined
  onConfirm: () => void
  onCancel: () => void
}

const shorten = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`

/** "Remove this sender?" — drops the address from the draft; nothing changes on-chain until the list is saved. */
export function RemoveRoleModal({ kind, address, friends, onConfirm, onCancel }: Props) {
  const { t } = useTranslation()
  const friend = useMemo(() => friends?.find(candidate => candidate.address === address), [friends, address])
  // The row already fetched this profile, so the name comes from the cache.
  const profile = useProfile(friend ? undefined : address)
  const name = friend?.name ?? profile.data?.name ?? shorten(address)

  return (
    <ConfirmModal
      title={t(`manage_roles_modal.${kind}.remove_title`)}
      description={t(`manage_roles_modal.${kind}.remove_description`, { name })}
      onClose={onCancel}
      cancel={{ label: t('manage_roles_modal.remove_cancel'), onClick: onCancel, testId: 'remove-role-cancel' }}
      confirm={{ label: t('manage_roles_modal.remove_confirm'), onClick: onConfirm, testId: 'remove-role-confirm' }}
      testId="remove-role-modal"
    />
  )
}

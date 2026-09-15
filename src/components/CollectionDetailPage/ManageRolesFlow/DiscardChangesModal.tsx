import { useTranslation } from '~/intl'
import { ConfirmModal } from '~/components/ConfirmModal'

type Props = {
  onDiscard: () => void
  onKeep: () => void
}

/** Closing the role list with unsaved changes: keep editing (default), or leave and lose them. */
export function DiscardChangesModal({ onDiscard, onKeep }: Props) {
  const { t } = useTranslation()
  return (
    <ConfirmModal
      title={t('manage_roles_modal.discard.title')}
      description={t('manage_roles_modal.discard.description')}
      onClose={onKeep}
      cancel={{ label: t('manage_roles_modal.discard.leave'), onClick: onDiscard, testId: 'discard-roles-leave' }}
      confirm={{ label: t('manage_roles_modal.discard.keep'), onClick: onKeep, testId: 'discard-roles-keep' }}
      testId="discard-roles-modal"
    />
  )
}

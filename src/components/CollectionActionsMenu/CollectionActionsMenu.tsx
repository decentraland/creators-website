import { useState } from 'react'
import { useTranslation } from '~/intl'
import { useDeleteCollection } from '~/hooks/useCollection'
import { copyToClipboard } from '~/lib/clipboard'
import { isCollectionLocked, type Collection } from '~/lib/collections'
import { useNotifications } from '~/lib/notifications'
import { ActionsMenu, ActionsMenuDivider, ActionsMenuItem } from '~/components/ActionsMenu'
import { DeleteCollectionModal } from './DeleteCollectionModal'

type Props = {
  collection: Collection
  address: string
  /** Compact 32px trigger for table rows; the default is the page-header icon button. */
  variant?: 'header' | 'row'
  /** The owner-only role placeholders (collaborators / minters); off in list rows. */
  showRoles?: boolean
  label?: string
  onDeleted?: () => void
}

export function CollectionActionsMenu({
  collection,
  address,
  variant = 'header',
  showRoles = true,
  label,
  onDeleted
}: Props) {
  const { t } = useTranslation()
  const showToast = useNotifications(state => state.showToast)
  const deleteCollection = useDeleteCollection(address)
  const [isDeleteOpen, setDeleteOpen] = useState(false)

  const isOnChain = collection.isPublished
  const isOwner = collection.owner.toLowerCase() === address.toLowerCase()
  // A locked draft has a publish transaction in flight: nothing can be done to it yet.
  const canDelete = !isOnChain && !isCollectionLocked(collection)

  if (!isOnChain && !canDelete) return null

  async function copy(text: string | undefined, successKey: string) {
    const copied = !!text && (await copyToClipboard(text))
    if (copied) showToast(t(successKey))
    else showToast(t('collection_detail_page.actions.copy_failed'), { type: 'error' })
  }

  function confirmDelete() {
    deleteCollection.mutate(collection.id, {
      onSuccess: () => {
        setDeleteOpen(false)
        showToast(t('collection_detail_page.actions.deleted', { name: collection.name }))
        onDeleted?.()
      },
      onError: () => showToast(t('collection_detail_page.actions.delete_error'), { type: 'error' })
    })
  }

  return (
    <>
      <ActionsMenu
        label={label ?? t('collection_detail_page.more_actions')}
        variant={variant}
        testId="collection-actions"
      >
        {isOnChain && (
          <>
            <ActionsMenuItem
              testId="copy-urn"
              onClick={() => void copy(collection.urn, 'collection_detail_page.actions.copied_urn')}
            >
              {t('collection_detail_page.actions.copy_urn')}
            </ActionsMenuItem>
            <ActionsMenuItem
              testId="copy-address"
              onClick={() => void copy(collection.contractAddress, 'collection_detail_page.actions.copied_address')}
            >
              {t('collection_detail_page.actions.copy_address')}
            </ActionsMenuItem>
          </>
        )}
        {isOnChain && isOwner && showRoles && (
          <>
            <ActionsMenuDivider />
            {/* TODO: wire the on-chain setManagers / setMinters flows (legacy ManageCollectionRoleModal). */}
            <ActionsMenuItem disabled title={t('collection_detail_page.coming_soon')} testId="manage-collaborators">
              {t('collection_detail_page.actions.collaborators')}
            </ActionsMenuItem>
            <ActionsMenuItem disabled title={t('collection_detail_page.coming_soon')} testId="manage-minters">
              {t('collection_detail_page.actions.minters')}
            </ActionsMenuItem>
          </>
        )}
        {canDelete && (
          <ActionsMenuItem testId="delete-collection" onClick={() => setDeleteOpen(true)}>
            {t('collection_detail_page.actions.delete')}
          </ActionsMenuItem>
        )}
      </ActionsMenu>

      {isDeleteOpen && (
        <DeleteCollectionModal
          name={collection.name}
          isDeleting={deleteCollection.isPending}
          onConfirm={confirmDelete}
          onClose={() => setDeleteOpen(false)}
        />
      )}
    </>
  )
}

import { useState } from 'react'
import { OpenInNew as OpenInNewIcon } from '@mui/icons-material'
import { useTranslation } from '~/intl'
import { useDeleteCollection } from '~/hooks/useCollection'
import { useMediaQuery } from '~/hooks/useMediaQuery'
import { copyToClipboard } from '~/lib/clipboard'
import { track } from '~/lib/analytics'
import { hasBeenApproved, isCollectionLocked, isLinkedCollection, type Collection } from '~/lib/collections'
import { builderLinkedCollectionUrl } from '~/lib/linkedCollections'
import { isCollectionOwner, type RoleKind } from '~/lib/collectionRoles'
import { openForumPost } from '~/lib/forumPost'
import { openExternal } from '~/lib/navigation'
import { shopCollectionUrl } from '~/lib/shop'
import { useNotifications } from '~/lib/notifications'
import { theme } from '~/styles/theme'
import { ActionsMenu, ActionsMenuDivider, ActionsMenuItem } from '~/components/ActionsMenu'
import { DeleteCollectionModal } from './DeleteCollectionModal'

type Props = {
  collection: Collection
  address: string
  /** Compact 32px trigger for table rows; the default is the page-header icon button. */
  variant?: 'header' | 'row'
  /** The owner-only role entries (collaborators / senders); off in list rows. */
  showRoles?: boolean
  label?: string
  /** Opens the Send Items flow; the header button covers this on desktop, so the item shows only when compact. */
  onSendItems?: () => void
  /** Opens the items in the editor; the header button covers this on desktop, so the item shows only when compact. */
  onPreviewItems?: () => void
  /** The collection's forum post; the header button covers it on desktop, so the item shows only when compact. */
  forumLink?: string
  /** Opens the collaborators / senders list; without it the owner-only entries are not rendered. */
  onManageRoles?: (kind: RoleKind) => void
  /** Opens the transfer-ownership dialog; without it the owner-only entry is not rendered. */
  onTransferOwnership?: () => void
  onDeleted?: () => void
}

export function CollectionActionsMenu({
  collection,
  address,
  variant = 'header',
  showRoles = true,
  label,
  onSendItems,
  onPreviewItems,
  forumLink,
  onManageRoles,
  onTransferOwnership,
  onDeleted
}: Props) {
  const { t } = useTranslation()
  const showToast = useNotifications(state => state.showToast)
  const deleteCollection = useDeleteCollection(address)
  const [isDeleteOpen, setDeleteOpen] = useState(false)

  // Small screens are mostly a viewer: copying and the role lists stay, deleting is desktop-only.
  const compact = useMediaQuery(theme.media.noActions)

  const isOnChain = collection.isPublished
  const isOwner = isCollectionOwner(collection, address)
  const shopUrl =
    hasBeenApproved(collection) && collection.contractAddress ? shopCollectionUrl(collection.contractAddress) : null
  // A locked draft has a publish transaction in flight: nothing can be done to it yet.
  const canDelete = !compact && !isOnChain && !isCollectionLocked(collection)
  // The header's Send Items button is desktop-only, so the menu carries the action on small screens.
  const showSend = compact && !!onSendItems
  // Same for the header's Open Editor button; on mobile the editor is a viewer, hence "Preview".
  const showPreview = compact && !!onPreviewItems
  const showForum = compact && !!forumLink

  // Linked collections are edited in the legacy builder, which is desktop-only: on small screens there is nothing to offer.
  if (isLinkedCollection(collection)) {
    if (compact) return null
    return (
      <ActionsMenu
        label={label ?? t('collection_detail_page.more_actions')}
        variant={variant}
        testId="collection-actions"
      >
        <ActionsMenuItem
          testId="edit-in-builder"
          onClick={() => {
            // The linked detail page has its own button, so only list rows reach this menu.
            track('Edit linked collection in builder', { collectionId: collection.id, source: 'list' })
            openExternal(builderLinkedCollectionUrl(collection.id))
          }}
        >
          {t('linked_collection.edit_in_builder')}
          <OpenInNewIcon aria-hidden />
        </ActionsMenuItem>
      </ActionsMenu>
    )
  }

  if (!isOnChain && !canDelete && !showSend && !showPreview && !showForum) return null

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
        {showPreview && (
          <ActionsMenuItem testId="preview-items-action" onClick={onPreviewItems}>
            {t('collection_detail_page.actions.preview_items')}
          </ActionsMenuItem>
        )}
        {showSend && (
          <ActionsMenuItem testId="send-items-action" onClick={onSendItems}>
            {t('collection_detail_page.send_items')}
          </ActionsMenuItem>
        )}
        {showForum && (
          <ActionsMenuItem
            testId="forum-post-action"
            onClick={() => openForumPost({ ...collection, forumLink }, 'detail_menu')}
          >
            {t('collection_detail_page.forum_post')}
            <OpenInNewIcon aria-hidden />
          </ActionsMenuItem>
        )}
        {isOnChain && (
          <>
            {(showSend || showPreview || showForum) && <ActionsMenuDivider />}
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
            {shopUrl && (
              <ActionsMenuItem testId="view-in-shop" onClick={() => openExternal(shopUrl)}>
                {t('collection_detail_page.actions.view_in_shop')}
                <OpenInNewIcon aria-hidden />
              </ActionsMenuItem>
            )}
          </>
        )}
        {isOnChain && isOwner && showRoles && onManageRoles && (
          <>
            <ActionsMenuDivider />
            <ActionsMenuItem testId="manage-collaborators" onClick={() => onManageRoles('collaborators')}>
              {t('collection_detail_page.actions.collaborators')}
            </ActionsMenuItem>
            <ActionsMenuItem testId="manage-senders" onClick={() => onManageRoles('senders')}>
              {t('collection_detail_page.actions.senders')}
            </ActionsMenuItem>
          </>
        )}
        {isOnChain && isOwner && showRoles && onTransferOwnership && (
          <>
            <ActionsMenuDivider />
            <ActionsMenuItem testId="transfer-ownership" tone="danger" onClick={onTransferOwnership}>
              {t('collection_detail_page.actions.transfer_ownership')}
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

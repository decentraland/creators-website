import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from '~/intl'
import { useDraftCollections } from '~/hooks/useCollections'
import { useMoveItem, useResetItem } from '~/hooks/useItem'
import { type ItemSync } from '~/hooks/useItemSync'
import { useDeleteItem } from '~/hooks/usePublishCollection'
import { copyToClipboard } from '~/lib/clipboard'
import { hasBeenApproved, isCollectionLocked, type Collection } from '~/lib/collections'
import { ItemSyncStatus } from '~/lib/itemSync'
import { canManageItem, type Item } from '~/lib/items'
import { type ItemListing } from '~/lib/listings'
import { useNotifications } from '~/lib/notifications'
import { ActionsMenu, ActionsMenuDivider, ActionsMenuItem } from '~/components/ActionsMenu'
import { DeleteItemModal } from '../DeleteItemModal'
import { MoveItemModal } from './MoveItemModal'
import { ResetItemModal } from './ResetItemModal'

type Props = {
  item: Item
  collection: Collection
  address: string
  /** Catalyst sync of the item; absent while unknown. */
  sync?: ItemSync
  /** The item's primary listing, when the collection is on the market: `null` when not on sale. */
  listing?: ItemListing | null
}

type Dialog = 'move' | 'reset' | 'delete' | null

export function ItemActionsMenu({ item, collection, address, sync, listing }: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const showToast = useNotifications(state => state.showToast)
  const [dialog, setDialog] = useState<Dialog>(null)

  const moveItem = useMoveItem(address)
  const resetItem = useResetItem(address)
  const deleteItem = useDeleteItem(address)
  const drafts = useDraftCollections(address, dialog === 'move')

  const isDraft = !collection.isPublished && !isCollectionLocked(collection)
  const canManage = canManageItem(collection, item, address)
  const onMarket = hasBeenApproved(collection)
  const canReset = canManage && sync?.status === ItemSyncStatus.UNSYNCED && !!sync.entity
  const isOnSale = !!listing

  async function copyUrn() {
    const copied = !!item.urn && (await copyToClipboard(item.urn))
    if (copied) showToast(t('collection_detail_page.item_actions.copied_urn'))
    else showToast(t('collection_detail_page.actions.copy_failed'), { type: 'error' })
  }

  function openEditor() {
    navigate(`/collections/editor?collection=${collection.id}&item=${item.id}`)
  }

  function closeDialog() {
    setDialog(null)
    moveItem.reset()
    resetItem.reset()
    deleteItem.reset()
  }

  function confirmMove(target: Collection) {
    moveItem.mutate(
      { item, collectionId: target.id },
      {
        onSuccess: () => {
          closeDialog()
          showToast(
            t('collection_detail_page.item_actions.move_modal.moved', { item: item.name, collection: target.name })
          )
        }
      }
    )
  }

  function confirmReset() {
    if (!sync?.entity) return
    resetItem.mutate(
      { item, entity: sync.entity },
      {
        onSuccess: () => {
          closeDialog()
          showToast(t('collection_detail_page.item_actions.reset_modal.done', { name: item.name }))
        }
      }
    )
  }

  function confirmDelete() {
    deleteItem.mutate(item, {
      onSuccess: () => {
        closeDialog()
        showToast(t('collection_detail_page.item_actions.deleted', { name: item.name }))
      }
    })
  }

  return (
    <>
      <ActionsMenu label={t('collection_detail_page.row_actions')} variant="row" testId="item-actions">
        {item.urn && (
          <ActionsMenuItem testId="item-copy-urn" onClick={() => void copyUrn()}>
            {t('collection_detail_page.item_actions.copy_urn')}
          </ActionsMenuItem>
        )}
        <ActionsMenuItem testId="item-preview" onClick={openEditor}>
          {t('collection_detail_page.item_actions.preview')}
        </ActionsMenuItem>
        {isDraft && canManage && (
          <ActionsMenuItem testId="item-move" onClick={() => setDialog('move')}>
            {t('collection_detail_page.item_actions.move')}
          </ActionsMenuItem>
        )}
        {onMarket && canManage && (
          <>
            {/* TODO: price editing and delisting land with the sale flows. */}
            <ActionsMenuItem disabled title={t('collection_detail_page.coming_soon')} testId="item-edit-price">
              {t('collection_detail_page.item_actions.edit_price')}
            </ActionsMenuItem>
            {isOnSale && (
              <ActionsMenuItem disabled title={t('collection_detail_page.coming_soon')} testId="item-remove-from-sale">
                {t('collection_detail_page.item_actions.remove_from_sale')}
              </ActionsMenuItem>
            )}
          </>
        )}
        {canReset && (
          <ActionsMenuItem testId="item-reset" onClick={() => setDialog('reset')}>
            {t('collection_detail_page.item_actions.reset')}
          </ActionsMenuItem>
        )}
        {isDraft && canManage && (
          <>
            <ActionsMenuDivider />
            <ActionsMenuItem testId="item-delete" onClick={() => setDialog('delete')}>
              {t('collection_detail_page.item_actions.delete')}
            </ActionsMenuItem>
          </>
        )}
      </ActionsMenu>

      {dialog === 'move' && (
        <MoveItemModal
          item={item}
          collections={drafts.data}
          isMoving={moveItem.isPending}
          error={moveItem.isError}
          onConfirm={confirmMove}
          onClose={closeDialog}
        />
      )}
      {dialog === 'reset' && (
        <ResetItemModal
          item={item}
          isResetting={resetItem.isPending}
          error={resetItem.isError}
          onConfirm={confirmReset}
          onClose={closeDialog}
        />
      )}
      {dialog === 'delete' && (
        <DeleteItemModal
          item={item}
          isDeleting={deleteItem.isPending}
          error={deleteItem.isError}
          onCancel={closeDialog}
          onConfirm={confirmDelete}
        />
      )}
    </>
  )
}

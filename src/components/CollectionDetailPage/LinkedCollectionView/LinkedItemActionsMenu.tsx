import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from '~/intl'
import { useMediaQuery } from '~/hooks/useMediaQuery'
import { useDeleteItem } from '~/hooks/usePublishCollection'
import { useSaveItem } from '~/hooks/useSaveItem'
import { track } from '~/lib/analytics'
import { copyToClipboard } from '~/lib/clipboard'
import { type Collection } from '~/lib/collections'
import { type Item } from '~/lib/items'
import { isLinkedItemPublished, type ItemCuration } from '~/lib/linkedItemStatus'
import { useNotifications } from '~/lib/notifications'
import { buildLinkedItemUrn, decodeLinkedUrn } from '~/lib/thirdParty'
import { theme } from '~/styles/theme'
import { ActionsMenu, ActionsMenuDivider, ActionsMenuItem } from '~/components/ActionsMenu'
import { EditUrnModal } from './EditUrnModal'
import { DeleteItemModal } from '../DeleteItemModal'

type Props = {
  item: Item
  collection: Collection
  address: string
  /** The item's latest curation; null when it has none, undefined while unknown. */
  curation: ItemCuration | null | undefined
  onDeleted?: () => void
}

type Dialog = 'urn' | 'delete' | null

/** The ⋯ menu of a linked item row: open in the editor, copy or edit its URN, delete it while unpublished. */
export function LinkedItemActionsMenu({ item, collection, address, curation, onDeleted }: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const showToast = useNotifications(state => state.showToast)
  const saveItem = useSaveItem(address)
  const deleteItem = useDeleteItem(address)
  const [dialog, setDialog] = useState<Dialog>(null)
  // Small screens are a viewer: only copying the URN stays available there.
  const compact = useMediaQuery(theme.media.noActions)

  // Until its curation is known the item is treated as published: a locked action is better than a 409.
  const isPublished = curation === undefined || isLinkedItemPublished(item, curation)
  const decoded = decodeLinkedUrn(item.urn)
  const canEditUrn = !compact && !isPublished && !!decoded?.itemSuffix
  const canDelete = !compact && !isPublished

  async function copyUrn() {
    const copied = !!item.urn && (await copyToClipboard(item.urn))
    if (copied) showToast(t('collection_detail_page.item_actions.copied_urn'))
    else showToast(t('collection_detail_page.actions.copy_failed'), { type: 'error' })
  }

  function closeDialog() {
    setDialog(null)
    saveItem.reset()
    deleteItem.reset()
  }

  function saveUrn(suffix: string) {
    const urn = buildLinkedItemUrn(collection.urn, suffix)
    saveItem.mutate(
      { item: { ...item, urn } },
      {
        onSuccess: () => {
          track('Change TP Item URN', { oldURN: item.urn, newURN: urn })
          closeDialog()
          showToast(t('linked_collection.urn_saved'))
        }
      }
    )
  }

  function confirmDelete() {
    deleteItem.mutate(item, {
      onSuccess: () => {
        closeDialog()
        onDeleted?.()
        showToast(t('collection_detail_page.item_actions.deleted', { name: item.name }))
      },
      onError: () => showToast(t('collection_detail_page.delete_item.error'), { type: 'error' })
    })
  }

  return (
    <>
      <ActionsMenu label={t('collection_detail_page.row_actions')} variant="row" testId="item-actions">
        {!compact && (
          <ActionsMenuItem
            testId="item-preview"
            onClick={() => navigate(`/collections/editor?collection=${collection.id}&item=${item.id}`)}
          >
            {t('collection_detail_page.item_actions.open_in_editor')}
          </ActionsMenuItem>
        )}
        {item.urn && (
          <ActionsMenuItem testId="item-copy-urn" onClick={() => void copyUrn()}>
            {t('collection_detail_page.item_actions.copy_urn')}
          </ActionsMenuItem>
        )}
        {canEditUrn && (
          <ActionsMenuItem testId="item-edit-urn" onClick={() => setDialog('urn')}>
            {t('linked_collection.item_actions.edit_urn')}
          </ActionsMenuItem>
        )}
        {canDelete && (
          <>
            <ActionsMenuDivider />
            <ActionsMenuItem testId="item-delete" onClick={() => setDialog('delete')}>
              {t('collection_detail_page.item_actions.delete')}
            </ActionsMenuItem>
          </>
        )}
      </ActionsMenu>

      {dialog === 'urn' && decoded?.itemSuffix && (
        <EditUrnModal
          kind="item"
          urnPrefix={collection.urn}
          initialSuffix={decoded.itemSuffix}
          isPending={saveItem.isPending}
          error={saveItem.isError ? t('linked_collection.urn_error') : null}
          onSubmit={saveUrn}
          onClose={closeDialog}
        />
      )}
      {dialog === 'delete' && (
        <DeleteItemModal
          item={item}
          isDeleting={deleteItem.isPending}
          onCancel={closeDialog}
          onConfirm={confirmDelete}
        />
      )}
    </>
  )
}

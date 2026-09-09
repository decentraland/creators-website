import { useEffect, useRef, useState } from 'react'
import { MoreHoriz as MoreHorizIcon } from '@mui/icons-material'
import { useTranslation } from '~/intl'
import { useDeleteCollection } from '~/hooks/useCollection'
import { copyToClipboard } from '~/lib/clipboard'
import { isCollectionLocked, type Collection } from '~/lib/collections'
import { useNotifications } from '~/lib/notifications'
import { DeleteCollectionModal } from './DeleteCollectionModal'
import * as S from './CollectionActionsMenu.styles'

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

  const [isOpen, setOpen] = useState(false)
  const [isDeleteOpen, setDeleteOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const isOnChain = collection.isPublished
  const isOwner = collection.owner.toLowerCase() === address.toLowerCase()
  // A locked draft has a publish transaction in flight: nothing can be done to it yet.
  const canDelete = !isOnChain && !isCollectionLocked(collection)

  useEffect(() => {
    if (!isOpen) return
    function onMouseDown(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen])

  if (!isOnChain && !canDelete) return null

  async function copy(text: string | undefined, successKey: string) {
    setOpen(false)
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
    <S.Wrap ref={wrapRef}>
      <S.Trigger
        variant="secondary"
        size="icon"
        type="button"
        aria-label={label ?? t('collection_detail_page.more_actions')}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        data-compact={variant === 'row' || undefined}
        data-testid="collection-actions"
        onClick={() => setOpen(open => !open)}
      >
        <MoreHorizIcon fontSize={variant === 'row' ? 'small' : 'medium'} />
      </S.Trigger>

      {isOpen && (
        <S.Menu role="menu" data-testid="collection-actions-menu">
          {isOnChain && (
            <>
              <S.Item
                type="button"
                role="menuitem"
                data-testid="copy-urn"
                onClick={() => void copy(collection.urn, 'collection_detail_page.actions.copied_urn')}
              >
                {t('collection_detail_page.actions.copy_urn')}
              </S.Item>
              <S.Item
                type="button"
                role="menuitem"
                data-testid="copy-address"
                onClick={() => void copy(collection.contractAddress, 'collection_detail_page.actions.copied_address')}
              >
                {t('collection_detail_page.actions.copy_address')}
              </S.Item>
            </>
          )}
          {isOnChain && isOwner && showRoles && (
            <>
              <S.Divider />
              {/* TODO: wire the on-chain setManagers / setMinters flows (legacy ManageCollectionRoleModal). */}
              <S.Item
                type="button"
                role="menuitem"
                aria-disabled
                title={t('collection_detail_page.coming_soon')}
                data-testid="manage-collaborators"
              >
                {t('collection_detail_page.actions.collaborators')}
              </S.Item>
              <S.Item
                type="button"
                role="menuitem"
                aria-disabled
                title={t('collection_detail_page.coming_soon')}
                data-testid="manage-minters"
              >
                {t('collection_detail_page.actions.minters')}
              </S.Item>
            </>
          )}
          {canDelete && (
            <S.Item
              type="button"
              role="menuitem"
              data-testid="delete-collection"
              onClick={() => {
                setOpen(false)
                setDeleteOpen(true)
              }}
            >
              {t('collection_detail_page.actions.delete')}
            </S.Item>
          )}
        </S.Menu>
      )}

      {isDeleteOpen && (
        <DeleteCollectionModal
          name={collection.name}
          isDeleting={deleteCollection.isPending}
          onConfirm={confirmDelete}
          onClose={() => setDeleteOpen(false)}
        />
      )}
    </S.Wrap>
  )
}

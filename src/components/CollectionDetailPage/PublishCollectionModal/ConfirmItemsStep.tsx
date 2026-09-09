import { useEffect, useState } from 'react'
import { ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon } from '@mui/icons-material'
import { useTranslation } from '~/intl'
import { useDeleteItem, useItemContents, useUpdateItem } from '~/hooks/usePublishCollection'
import { THUMBNAIL_PATH } from '~/lib/itemFiles'
import { type Item } from '~/lib/items'
import { Button } from '~/components/Button'
import { ThumbnailModal, type ThumbnailPatch } from '~/components/ThumbnailModal'
import { Checkbox } from './Checkbox'
import { DeleteItemModal } from './DeleteItemModal'
import { PublishItemRow } from './PublishItemRow'
import { ITEM_COLUMNS } from './PublishItemRow.styles'
import * as S from './PublishCollectionModal.styles'

type Props = {
  address: string
  items: Item[]
  onBusyChange: (busy: boolean) => void
  onBack: () => void
  onConfirm: () => void
}

/** Step 2: review every item; names and rarities are editable in place, items can be removed. */
export function ConfirmItemsStep({ address, items, onBusyChange, onBack, onConfirm }: Props) {
  const { t } = useTranslation()
  const [accepted, setAccepted] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<Item | null>(null)
  // Thumbnail edits stay local until the row is saved, so cancelling the row discards them too.
  const [thumbnailPatch, setThumbnailPatch] = useState<ThumbnailPatch | null>(null)
  const [isThumbnailOpen, setThumbnailOpen] = useState(false)

  const updateItem = useUpdateItem(address)
  const deleteItem = useDeleteItem(address)
  const editingItem = items.find(item => item.id === editingId) ?? null
  const itemContents = useItemContents(isThumbnailOpen ? editingItem : null)

  const canContinue = accepted && items.length > 0 && editingId === null

  const isBusy = updateItem.isPending || deleteItem.isPending
  useEffect(() => {
    onBusyChange(isBusy)
  }, [isBusy, onBusyChange])

  function stopEditing() {
    updateItem.reset()
    setEditingId(null)
    setThumbnailPatch(null)
  }

  function saveRow(item: Item, changes: { name: string; rarity: string }) {
    if (!thumbnailPatch && changes.name === item.name && changes.rarity === item.rarity) {
      stopEditing()
      return
    }
    updateItem.mutate(
      { item: { ...item, ...changes }, thumbnail: thumbnailPatch?.contents[THUMBNAIL_PATH] },
      { onSuccess: stopEditing }
    )
  }

  function confirmDelete() {
    if (!deleting) return
    deleteItem.mutate(deleting, { onSuccess: () => setDeleting(null) })
  }

  return (
    <S.Step data-testid="publish-items-step">
      <S.Heading>{t('publish_collection_modal.items_step.title')}</S.Heading>
      <div>
        <S.Lead>{t('publish_collection_modal.items_step.subtitle')}</S.Lead>
        <S.Text>{t('publish_collection_modal.items_step.description')}</S.Text>
      </div>
      <S.Table>
        <S.TableHeader style={{ gridTemplateColumns: ITEM_COLUMNS }}>
          <span>{t('publish_collection_modal.items_step.columns.item')}</span>
          <span>{t('publish_collection_modal.items_step.columns.body_shape')}</span>
          <span>{t('publish_collection_modal.items_step.columns.category')}</span>
          <span>{t('publish_collection_modal.items_step.columns.rarity')}</span>
          <span>{t('publish_collection_modal.items_step.columns.actions')}</span>
        </S.TableHeader>
        <S.TableBody data-testid="publish-items-list">
          {items.length === 0 ? (
            <S.InlineNote data-testid="publish-items-empty">
              {t('publish_collection_modal.items_step.empty')}
            </S.InlineNote>
          ) : (
            items.map(item => (
              <PublishItemRow
                key={item.id}
                item={item}
                isEditing={editingId === item.id}
                isSaving={editingId === item.id && updateItem.isPending}
                saveError={editingId === item.id && updateItem.isError}
                canDelete={items.length > 1}
                locked={editingId !== null && editingId !== item.id}
                pendingThumbnail={editingId === item.id ? (thumbnailPatch?.thumbnail ?? null) : null}
                onEdit={() => {
                  updateItem.reset()
                  setEditingId(item.id)
                }}
                onCancelEdit={stopEditing}
                onEditThumbnail={() => setThumbnailOpen(true)}
                onSave={changes => saveRow(item, changes)}
                onDelete={() => {
                  deleteItem.reset()
                  setDeleting(item)
                }}
              />
            ))
          )}
        </S.TableBody>
      </S.Table>
      <Checkbox checked={accepted} onChange={setAccepted} testId="publish-items-accept">
        {t('publish_collection_modal.items_step.checkbox')}
      </Checkbox>
      <S.Footer>
        <Button type="button" variant="secondary" data-testid="publish-back" onClick={onBack}>
          <ChevronLeftIcon fontSize="small" />
          {t('publish_collection_modal.back')}
        </Button>
        <Button type="button" disabled={!canContinue} data-testid="publish-items-confirm" onClick={onConfirm}>
          {t('publish_collection_modal.items_step.confirm')}
          <ChevronRightIcon fontSize="small" />
        </Button>
      </S.Footer>

      {isThumbnailOpen && editingItem && (
        <ThumbnailModal
          type={editingItem.type}
          contents={itemContents.data ?? null}
          loadError={itemContents.isError}
          onClose={() => setThumbnailOpen(false)}
          onSave={patch => {
            setThumbnailPatch(patch)
            setThumbnailOpen(false)
          }}
        />
      )}

      {deleting && (
        <DeleteItemModal
          item={deleting}
          isDeleting={deleteItem.isPending}
          error={deleteItem.isError}
          onCancel={() => setDeleting(null)}
          onConfirm={confirmDelete}
        />
      )}
    </S.Step>
  )
}

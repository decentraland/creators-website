import { useState } from 'react'
import { Check as CheckIcon, Close as CloseIcon, Edit as EditIcon } from '@mui/icons-material'
import { useTranslation } from '~/intl'
import { getContentsStorageUrl } from '~/lib/builder'
import { ItemThumbnail } from '~/components/ItemThumbnail'
import { ITEM_NAME_MAX_LENGTH, isValidItemName } from '~/lib/itemFactory'
import { getItemBodyShapeType, type Item } from '~/lib/items'
import { DEFAULT_RARITY, isRarity, type RarityName } from '~/lib/rarities'
import { TrashIcon } from '~/components/Icons'
import { BodyShapeIcon, CategoryIcon } from '~/components/ItemIcons'
import { RarityPill } from '~/components/RarityPill'
import { RaritySelect } from '~/components/RaritySelect'
import * as Shared from './PublishCollectionModal.styles'
import * as S from './PublishItemRow.styles'

type Props = {
  item: Item
  isEditing: boolean
  isSaving: boolean
  saveError: boolean
  canDelete: boolean
  /** Other rows lock while one is being edited. */
  locked: boolean
  /** Data URL of a thumbnail picked during this edit, shown instead of the saved one. */
  pendingThumbnail: string | null
  onEdit: () => void
  onEditThumbnail: () => void
  onCancelEdit: () => void
  onSave: (changes: { name: string; rarity: string }) => void
  onDelete: () => void
}

/** One item of the review table: read-only, or inline-editing its name and rarity. */
export function PublishItemRow({
  item,
  isEditing,
  isSaving,
  saveError,
  canDelete,
  locked,
  pendingThumbnail,
  onEdit,
  onEditThumbnail,
  onCancelEdit,
  onSave,
  onDelete
}: Props) {
  const { t } = useTranslation()
  const [name, setName] = useState(item.name)
  const [rarity, setRarity] = useState<RarityName>(isRarity(item.rarity) ? item.rarity : DEFAULT_RARITY)

  const thumbnailHash = item.contents[item.thumbnail]
  const thumbnailUrl = pendingThumbnail ?? (thumbnailHash ? getContentsStorageUrl(thumbnailHash) : null)
  const bodyShape = getItemBodyShapeType(item)
  const nameValid = isValidItemName(name)

  function startEditing() {
    setName(item.name)
    setRarity(isRarity(item.rarity) ? item.rarity : DEFAULT_RARITY)
    onEdit()
  }

  function save() {
    if (!nameValid || isSaving) return
    onSave({ name: name.trim(), rarity })
  }

  return (
    <S.Row data-testid="publish-item-row" data-item-id={item.id} data-editing={isEditing || undefined}>
      <S.NameCell>
        {isEditing ? (
          <S.ThumbButton
            type="button"
            title={t('publish_collection_modal.items_step.edit_thumbnail')}
            aria-label={t('publish_collection_modal.items_step.edit_thumbnail')}
            disabled={isSaving}
            data-testid="publish-item-edit-thumbnail"
            onClick={onEditThumbnail}
          >
            <Shared.Thumb>
              <ItemThumbnail src={thumbnailUrl} rarity={item.rarity} testId="publish-item" />
            </Shared.Thumb>
            <S.ThumbBadge aria-hidden>
              <EditIcon />
            </S.ThumbBadge>
          </S.ThumbButton>
        ) : (
          <Shared.Thumb>
            <ItemThumbnail src={thumbnailUrl} rarity={item.rarity} testId="publish-item" />
          </Shared.Thumb>
        )}
        {isEditing ? (
          <S.NameInput
            value={name}
            maxLength={ITEM_NAME_MAX_LENGTH}
            disabled={isSaving}
            autoFocus
            aria-label={t('publish_collection_modal.items_step.name_placeholder')}
            placeholder={t('publish_collection_modal.items_step.name_placeholder')}
            data-invalid={name && !nameValid ? true : undefined}
            data-testid="publish-item-name-input"
            onChange={event => setName(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') {
                event.preventDefault()
                save()
              }
            }}
          />
        ) : (
          <S.Name title={item.name} data-testid="publish-item-name">
            {item.name}
          </S.Name>
        )}
      </S.NameCell>
      <span data-testid="publish-item-body-type">
        {bodyShape ? <BodyShapeIcon bodyShape={bodyShape} withLabel /> : '—'}
      </span>
      <span data-testid="publish-item-category">
        {item.data.category ? <CategoryIcon category={item.data.category} withLabel /> : '—'}
      </span>
      <span data-testid="publish-item-rarity">
        {isEditing ? (
          <S.SelectCell>
            <RaritySelect value={rarity} onChange={setRarity} />
          </S.SelectCell>
        ) : (
          item.rarity && <RarityPill rarity={item.rarity} />
        )}
      </span>
      <S.Actions>
        {isEditing ? (
          <>
            <S.IconButton
              type="button"
              data-variant="cancel"
              title={t('publish_collection_modal.items_step.cancel_edit')}
              aria-label={t('publish_collection_modal.items_step.cancel_edit')}
              disabled={isSaving}
              data-testid="publish-item-cancel"
              onClick={onCancelEdit}
            >
              <CloseIcon />
            </S.IconButton>
            <S.IconButton
              type="button"
              data-variant="save"
              title={t('publish_collection_modal.items_step.save')}
              aria-label={t('publish_collection_modal.items_step.save')}
              disabled={!nameValid || isSaving}
              aria-busy={isSaving || undefined}
              data-testid="publish-item-save"
              onClick={save}
            >
              {isSaving ? <Shared.Spinner aria-hidden /> : <CheckIcon />}
            </S.IconButton>
          </>
        ) : (
          <>
            <S.IconButton
              type="button"
              title={t('publish_collection_modal.items_step.edit')}
              aria-label={t('publish_collection_modal.items_step.edit')}
              disabled={locked}
              data-testid="publish-item-edit"
              onClick={startEditing}
            >
              <EditIcon />
            </S.IconButton>
            {canDelete && (
              <S.IconButton
                type="button"
                title={t('publish_collection_modal.items_step.delete')}
                aria-label={t('publish_collection_modal.items_step.delete')}
                disabled={locked}
                data-testid="publish-item-delete"
                onClick={onDelete}
              >
                <TrashIcon />
              </S.IconButton>
            )}
          </>
        )}
      </S.Actions>
      {isEditing && saveError && (
        <S.RowError data-testid="publish-item-error">{t('publish_collection_modal.items_step.save_error')}</S.RowError>
      )}
    </S.Row>
  )
}

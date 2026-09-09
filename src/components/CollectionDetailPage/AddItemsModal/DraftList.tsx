import { Check as CheckIcon, ErrorRounded as ErrorIcon } from '@mui/icons-material'
import { EmoteIcon, TrashIcon, WearableIcon } from '~/components/Icons'
import { useTranslation } from '~/intl'
import { ItemType } from '~/lib/items'
import { type ItemDraft } from './AddItemsModal.state'
import * as S from './AddItemsModal.styles'
import { ItemThumbnail } from '~/components/ItemThumbnail'

type Props = {
  drafts: ItemDraft[]
  selectedId: string | null
  onSelect: (id: string) => void
  onRemove: (id: string) => void
}

/** Sidebar with one card per file in the batch; only this pane scrolls on long batches. */
export function DraftList({ drafts, selectedId, onSelect, onRemove }: Props) {
  const { t } = useTranslation()

  return (
    <S.Sidebar data-testid="draft-list">
      {drafts.map(draft => (
        <S.DraftCard
          key={draft.id}
          type="button"
          data-testid={`draft-${draft.id}`}
          data-selected={draft.id === selectedId || undefined}
          data-failed={draft.status === 'failed' || undefined}
          data-checked={draft.checked || undefined}
          onClick={() => onSelect(draft.id)}
        >
          <S.DraftThumbWrap>
            <ItemThumbnail src={draft.thumbnail} rarity={draft.rarity} testId={`draft-thumbnail-${draft.id}`} />
            {draft.status !== 'failed' && (
              <S.DraftCheck data-checked={draft.checked || undefined} data-testid={`draft-check-${draft.id}`}>
                {draft.checked && <CheckIcon />}
              </S.DraftCheck>
            )}
          </S.DraftThumbWrap>
          <S.DraftInfo>
            <S.DraftName>{draft.name || draft.fileName}</S.DraftName>
            {draft.status === 'failed' ? (
              <S.DraftError data-testid={`draft-error-${draft.id}`}>
                <ErrorIcon />
                {t('add_items_modal.file_error_label')}
              </S.DraftError>
            ) : draft.status === 'processing' || !draft.type ? (
              <S.DraftType>{t('add_items_modal.processing')}</S.DraftType>
            ) : (
              <S.DraftType>
                {draft.type === ItemType.EMOTE ? <EmoteIcon /> : <WearableIcon />}
                {t(`add_items_modal.type.${draft.type}`)}
              </S.DraftType>
            )}
          </S.DraftInfo>
          <S.DeleteButton
            role="button"
            aria-label={t('add_items_modal.delete')}
            title={t('add_items_modal.delete')}
            data-testid={`draft-remove-${draft.id}`}
            onClick={event => {
              event.stopPropagation()
              onRemove(draft.id)
            }}
          >
            <TrashIcon />
          </S.DeleteButton>
        </S.DraftCard>
      ))}
    </S.Sidebar>
  )
}

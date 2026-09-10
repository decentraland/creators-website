import { useMemo, useState } from 'react'
import { useTranslation } from '~/intl'
import { isCollectionLocked, type Collection } from '~/lib/collections'
import { type Item } from '~/lib/items'
import { Button } from '~/components/Button'
import { Modal } from '~/components/Modal'
import { Select } from '~/components/Select'
import * as S from './MoveItemModal.styles'

type Props = {
  item: Item
  /** The creator's draft collections; `undefined` while they load. */
  collections: Collection[] | undefined
  isMoving: boolean
  isLoading: boolean
  error: boolean
  onConfirm: (collection: Collection) => void
  onClose: () => void
}

/** Pick the draft collection an item moves to. Locked drafts (publish in flight) can't take items. */
export function MoveItemModal({ item, collections, isMoving, isLoading, error, onConfirm, onClose }: Props) {
  const { t } = useTranslation()
  const [targetId, setTargetId] = useState<string | null>(null)

  const targets = useMemo(
    () => (collections ?? []).filter(c => c.id !== item.collectionId && !isCollectionLocked(c)),
    [collections, item.collectionId]
  )
  const options = useMemo(() => targets.map(c => ({ value: c.id, label: c.name })), [targets])

  return (
    <Modal
      title={t('collection_detail_page.item_actions.move_modal.title')}
      onClose={onClose}
      closeDisabled={isMoving}
      testId="move-item-modal"
    >
      <S.Body>
        <S.Text data-testid="move-item-modal-description">
          {t('collection_detail_page.item_actions.move_modal.description', { name: item.name })}
        </S.Text>
        {isLoading ? (
          <S.Loading role="status" data-testid="move-item-loading">
            <S.Spinner aria-hidden />
            {t('collection_detail_page.item_actions.move_modal.loading')}
          </S.Loading>
        ) : targets.length === 0 ? (
          <S.Text data-testid="move-item-empty">{t('collection_detail_page.item_actions.move_modal.empty')}</S.Text>
        ) : (
          <S.Field>
            {t('collection_detail_page.item_actions.move_modal.collection')}
            <Select
              value={targetId}
              options={options}
              placeholder={t('collection_detail_page.item_actions.move_modal.placeholder')}
              onChange={setTargetId}
              testId="move-item-target"
            />
          </S.Field>
        )}
        {error && (
          <S.Error data-testid="move-item-error">{t('collection_detail_page.item_actions.move_modal.error')}</S.Error>
        )}
        <S.Actions>
          <Button
            type="button"
            variant="secondary"
            disabled={isMoving}
            data-testid="move-item-cancel"
            onClick={onClose}
          >
            {t('collection_detail_page.item_actions.move_modal.cancel')}
          </Button>
          <Button
            type="button"
            loading={isMoving}
            disabled={!targetId}
            data-testid="move-item-confirm"
            onClick={() => {
              const target = targets.find(c => c.id === targetId)
              if (target) onConfirm(target)
            }}
          >
            {t('collection_detail_page.item_actions.move_modal.confirm')}
          </Button>
        </S.Actions>
      </S.Body>
    </Modal>
  )
}

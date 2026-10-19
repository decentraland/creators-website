import { useState } from 'react'
import { ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon } from '@mui/icons-material'
import { type ContractNetwork } from '@dcl/schemas'
import { useTranslation } from '~/intl'
import { getContentsStorageUrl } from '~/lib/builder'
import { type Collection } from '~/lib/collections'
import { type Item } from '~/lib/items'
import { getMappingLabel } from '~/lib/mappings'
import { Button } from '~/components/Button'
import { Checkbox } from '~/components/Checkbox'
import { CategoryIcon } from '~/components/ItemIcons'
import { ItemThumbnail } from '~/components/ItemThumbnail'
import * as S from '../../PublishCollectionModal/PublishCollectionModal.styles'
import * as R from './LinkedPublishRow.styles'

type Props = {
  collection: Collection
  itemsToPublish: Item[]
  itemsToPush: Item[]
  /** The wallet prompt for the slots cheque is open. */
  isSigning: boolean
  signError: boolean
  onBack: () => void
  onConfirm: () => void
}

/** Step 2: the items about to be submitted, each with the token mapping that unlocks it; Next signs the cheque. */
export function LinkedItemsStep({
  collection,
  itemsToPublish,
  itemsToPush,
  isSigning,
  signError,
  onBack,
  onConfirm
}: Props) {
  const { t } = useTranslation()
  const [accepted, setAccepted] = useState(false)
  const network = collection.linkedContractNetwork as ContractNetwork | undefined
  const address = collection.linkedContractAddress

  const renderRows = (items: Item[], testId: string) =>
    items.map(item => {
      const thumbnailHash = item.contents[item.thumbnail]
      const mapping = getMappingLabel(item.mappings, network, address)
      return (
        <R.Row key={item.id} data-testid={testId}>
          <R.Name>
            <S.Thumb>
              <ItemThumbnail src={thumbnailHash ? getContentsStorageUrl(thumbnailHash) : null} rarity={item.rarity} />
            </S.Thumb>
            <span title={item.name}>{item.name}</span>
          </R.Name>
          <span>{item.data.category ? <CategoryIcon category={item.data.category} withLabel /> : '—'}</span>
          <span data-testid={`${testId}-mapping`}>{t(mapping.id, mapping.values)}</span>
        </R.Row>
      )
    })

  return (
    <S.Step data-testid="publish-linked-items-step">
      <S.Heading>{t('publish_linked_modal.items_step.title')}</S.Heading>
      <S.Text>{t('publish_linked_modal.items_step.description')}</S.Text>
      {itemsToPublish.length > 0 && (
        <S.Table>
          <S.TableHeader style={{ gridTemplateColumns: R.COLUMNS }}>
            <span>{t('publish_linked_modal.items_step.columns.item', { count: itemsToPublish.length })}</span>
            <span>{t('publish_collection_modal.items_step.columns.category')}</span>
            <span>{t('publish_linked_modal.items_step.columns.linked_to')}</span>
          </S.TableHeader>
          <S.TableBody data-testid="publish-linked-items-list">
            {renderRows(itemsToPublish, 'publish-linked-item')}
          </S.TableBody>
        </S.Table>
      )}
      {itemsToPush.length > 0 && (
        <S.Table>
          <S.TableHeader style={{ gridTemplateColumns: R.COLUMNS }}>
            <span>{t('publish_linked_modal.items_step.columns.changed', { count: itemsToPush.length })}</span>
            <span>{t('publish_collection_modal.items_step.columns.category')}</span>
            <span>{t('publish_linked_modal.items_step.columns.linked_to')}</span>
          </S.TableHeader>
          <S.TableBody data-testid="publish-linked-push-list">
            {renderRows(itemsToPush, 'publish-linked-push-item')}
          </S.TableBody>
        </S.Table>
      )}
      <Checkbox checked={accepted} disabled={isSigning} onChange={setAccepted} testId="publish-linked-items-accept">
        {t('publish_linked_modal.items_step.checkbox')}
      </Checkbox>
      {signError && (
        <S.ErrorText data-testid="publish-linked-sign-error">
          {t('publish_linked_modal.items_step.sign_error')}
        </S.ErrorText>
      )}
      <S.Footer>
        <Button type="button" variant="secondary" disabled={isSigning} data-testid="publish-back" onClick={onBack}>
          <ChevronLeftIcon fontSize="small" />
          {t('publish_collection_modal.back')}
        </Button>
        <Button
          type="button"
          disabled={!accepted}
          loading={isSigning}
          data-testid="publish-linked-items-confirm"
          onClick={onConfirm}
        >
          {t(
            itemsToPublish.length > 0
              ? 'publish_linked_modal.items_step.sign'
              : 'publish_collection_modal.items_step.confirm'
          )}
          <ChevronRightIcon fontSize="small" />
        </Button>
      </S.Footer>
    </S.Step>
  )
}

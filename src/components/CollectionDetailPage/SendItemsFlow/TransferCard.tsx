import { useState } from 'react'
import { Add as AddIcon, Close as CloseIcon, Remove as RemoveIcon } from '@mui/icons-material'
import { useTranslation } from '~/intl'
import { getContentsStorageUrl } from '~/lib/builder'
import { type Friend } from '~/lib/friends'
import { type Item } from '~/lib/items'
import { allocatedElsewhere, getStock, maxAmount, type Transfer } from '~/lib/mint'
import { Checkbox } from '~/components/Checkbox'
import { ItemThumbnail } from '~/components/ItemThumbnail'
import { BeneficiaryInput } from '../SellItemFlow/BeneficiaryInput'
import * as S from './SendItemsModal.styles'

type Props = {
  index: number
  transfers: Transfer[]
  items: Item[]
  friends: Friend[] | undefined
  isLoadingFriends: boolean
  onChange: (transfer: Transfer) => void
  onRemove?: () => void
}

/** One transfer: its recipients, and how many copies of each item every one of them gets. */
export function TransferCard({ index, transfers, items, friends, isLoadingFriends, onChange, onRemove }: Props) {
  const { t } = useTranslation()
  const transfer = transfers[index]
  const [adding, setAdding] = useState(false)
  const showInput = transfer.recipients.length === 0 || adding
  const testId = `transfer-${index + 1}`

  function setRecipients(recipients: string[]) {
    // More recipients may leave the amounts over the stock: bring them back within it.
    const scaled = { ...transfers[index], recipients }
    const next = transfers.map((current, i) => (i === index ? scaled : current))
    const amounts = Object.fromEntries(
      items
        .map(item => [item.id, Math.min(scaled.amounts[item.id] ?? 0, maxAmount(item, next, index))] as const)
        .filter(([, amount]) => amount > 0)
    )
    onChange({ recipients, amounts })
  }

  function setAmount(itemId: string, amount: number) {
    const amounts = { ...transfer.amounts }
    if (amount > 0) amounts[itemId] = amount
    else delete amounts[itemId]
    onChange({ ...transfer, amounts })
  }

  return (
    <S.Transfer data-testid={testId}>
      <S.TransferHead>
        {t('send_items_modal.transfer', { n: index + 1 })}
        {onRemove && (
          <S.RemoveTransfer
            type="button"
            aria-label={t('send_items_modal.remove_transfer')}
            data-testid={`${testId}-remove`}
            onClick={onRemove}
          >
            <CloseIcon fontSize="small" />
          </S.RemoveTransfer>
        )}
      </S.TransferHead>

      <S.Recipients>
        {transfer.recipients.map((address, i) => (
          <S.Recipient key={address}>
            <S.Index>{i + 1}</S.Index>
            <BeneficiaryInput
              value={address}
              onChange={() => setRecipients(transfer.recipients.filter(other => other !== address))}
              friends={friends}
              isLoadingFriends={isLoadingFriends}
              testId={`${testId}-recipient`}
            />
          </S.Recipient>
        ))}
        {showInput && (
          <S.Recipient>
            <S.Index>{transfer.recipients.length + 1}</S.Index>
            <BeneficiaryInput
              value=""
              onChange={address => {
                setRecipients([...transfer.recipients, address])
                setAdding(false)
              }}
              friends={friends}
              isLoadingFriends={isLoadingFriends}
              placeholder={t('send_items_modal.recipient_placeholder')}
              duplicateError={address =>
                transfer.recipients.includes(address) ? t('send_items_modal.duplicate_recipient') : null
              }
              testId={`${testId}-recipient`}
            />
          </S.Recipient>
        )}
      </S.Recipients>
      <S.LinkButton
        type="button"
        disabled={showInput}
        data-testid={`${testId}-add-recipient`}
        onClick={() => setAdding(true)}
      >
        <AddIcon />
        {t('send_items_modal.add_recipient')}
      </S.LinkButton>

      {transfer.recipients.length > 0 && <S.Label>{t('send_items_modal.items_for_recipient')}</S.Label>}
      <S.Items>
        {items.map(item => {
          const amount = transfer.amounts[item.id] ?? 0
          const stock = getStock(item)
          const max = maxAmount(item, transfers, index)
          const soldOut = stock.available === 0
          const remaining = stock.available - allocatedElsewhere(transfers, item.id)
          const thumbnailHash = item.contents[item.thumbnail]
          return (
            <S.ItemRow key={item.id} data-disabled={soldOut || undefined} data-testid={`${testId}-item-${item.id}`}>
              <Checkbox
                checked={amount > 0}
                disabled={soldOut || (amount === 0 && max === 0)}
                onChange={checked => setAmount(item.id, checked ? 1 : 0)}
                testId={`${testId}-item-${item.id}-check`}
              >
                <S.SrOnly>{t('send_items_modal.select_item', { name: item.name })}</S.SrOnly>
              </Checkbox>
              <S.Thumb>
                <ItemThumbnail
                  src={thumbnailHash ? getContentsStorageUrl(thumbnailHash) : null}
                  rarity={item.rarity}
                  testId={`${testId}-item-${item.id}-thumb`}
                />
              </S.Thumb>
              <S.ItemText>
                <S.ItemName title={item.name}>{item.name}</S.ItemName>
                <S.Label data-testid={`${testId}-item-${item.id}-stock`}>
                  {soldOut
                    ? t('send_items_modal.sold_out')
                    : t('send_items_modal.available', { available: remaining, total: stock.total })}
                </S.Label>
              </S.ItemText>
              <S.Stepper>
                <button
                  type="button"
                  aria-label={t('send_items_modal.decrease', { name: item.name })}
                  disabled={amount === 0}
                  data-testid={`${testId}-item-${item.id}-minus`}
                  onClick={() => setAmount(item.id, amount - 1)}
                >
                  <RemoveIcon />
                </button>
                <output data-testid={`${testId}-item-${item.id}-amount`}>{amount}</output>
                <button
                  type="button"
                  aria-label={t('send_items_modal.increase', { name: item.name })}
                  disabled={soldOut || amount >= max}
                  data-testid={`${testId}-item-${item.id}-plus`}
                  onClick={() => setAmount(item.id, amount + 1)}
                >
                  <AddIcon />
                </button>
              </S.Stepper>
            </S.ItemRow>
          )
        })}
      </S.Items>
    </S.Transfer>
  )
}

import { useMemo } from 'react'
import {
  Add as AddIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  ExpandMore as ExpandIcon
} from '@mui/icons-material'
import { useTranslation } from '~/intl'
import { useFriends } from '~/hooks/useSales'
import { useProfile } from '~/hooks/useProfile'
import { type Session } from '~/lib/auth'
import { getContentsStorageUrl } from '~/lib/builder'
import { type Friend } from '~/lib/friends'
import { type Item } from '~/lib/items'
import {
  MAX_ITEMS_PER_SEND,
  canContinue,
  copiesPerRecipient,
  createTransfer,
  getStock,
  totalCopies,
  type RecipientBundle,
  type Transfer,
  type TransferDraft
} from '~/lib/mint'
import { Button } from '~/components/Button'
import { ItemThumbnail } from '~/components/ItemThumbnail'
import { Modal } from '~/components/Modal'
import { StepIndicator } from '~/components/StepIndicator'
import * as Sell from '../SellItemFlow/SellItemModal.styles'
import { TransferCard } from './TransferCard'
import * as S from './SendItemsModal.styles'

export type SendStep = 'select' | 'confirm'

type Props = {
  items: Item[]
  session: Session
  step: SendStep
  transfers: TransferDraft[]
  onStep: (step: SendStep) => void
  onTransfers: (transfers: TransferDraft[]) => void
  /** A submit is in flight (custodial wallet, no prompt to wait for): the button spins. */
  busy: boolean
  onSubmit: () => void
  onClose: () => void
}

/** Two steps: pick recipients and copies per transfer, then review what each wallet ends up with before sending. */
export function SendItemsModal({
  items,
  session,
  step,
  transfers,
  onStep,
  onTransfers,
  busy,
  onSubmit,
  onClose
}: Props) {
  const { t } = useTranslation()
  const friends = useFriends(session, true)
  const total = useMemo(() => totalCopies(transfers), [transfers])
  const over = total > MAX_ITEMS_PER_SEND
  const bundles = useMemo(() => copiesPerRecipient(transfers), [transfers])
  const itemCount = useMemo(() => new Set(bundles.flatMap(bundle => Object.keys(bundle.amounts))).size, [bundles])

  function replace(index: number, transfer: Transfer) {
    onTransfers(transfers.map((current, i) => (i === index ? { ...transfer, key: current.key } : current)))
  }

  return (
    <Modal title={t('send_items_modal.title')} compact onClose={onClose} closeDisabled={busy} testId="send-items-modal">
      <Sell.Divider />
      <S.Steps>
        <StepIndicator
          current={step === 'select' ? 1 : 2}
          total={2}
          labels={[t('send_items_modal.step_select'), t('send_items_modal.step_confirm')]}
          testId="send-steps"
        />
      </S.Steps>
      <S.Body data-busy={busy || undefined} aria-busy={busy || undefined} {...(busy ? { inert: '' } : {})}>
        {step === 'select' ? (
          <>
            {transfers.map((transfer, index) => (
              <TransferCard
                key={transfer.key}
                index={index}
                transfers={transfers}
                items={items}
                friends={friends.data}
                isLoadingFriends={friends.isLoading}
                onChange={transfer => replace(index, transfer)}
                onRemove={transfers.length > 1 ? () => onTransfers(transfers.filter((_, i) => i !== index)) : undefined}
              />
            ))}
            <S.AddTransfer
              type="button"
              variant="secondary"
              data-testid="send-add-transfer"
              onClick={() => onTransfers([...transfers, createTransfer()])}
            >
              <AddIcon fontSize="small" />
              {t('send_items_modal.add_transfer')}
            </S.AddTransfer>
            <S.Total data-over={over || undefined} data-testid="send-total">
              <span>{t('send_items_modal.total', { count: total, max: MAX_ITEMS_PER_SEND })}</span>
              {over && <span>{t('send_items_modal.limit_reached', { max: MAX_ITEMS_PER_SEND })}</span>}
            </S.Total>
          </>
        ) : (
          <>
            <S.Intro>{t('send_items_modal.confirm_intro', { count: total })}</S.Intro>
            <S.Summary open data-testid="send-summary">
              <summary>
                {t('send_items_modal.summary', { recipients: bundles.length, items: itemCount, copies: total })}
                <ExpandIcon />
              </summary>
              <S.SummaryBody>
                {bundles.map(bundle => (
                  <RecipientSummary key={bundle.address} bundle={bundle} items={items} friends={friends.data} />
                ))}
              </S.SummaryBody>
            </S.Summary>
          </>
        )}
      </S.Body>

      <Sell.Footer>
        {step === 'select' ? (
          <Button type="button" variant="secondary" data-testid="send-cancel" onClick={onClose}>
            {t('sell_item_modal.cancel')}
          </Button>
        ) : (
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            data-testid="send-back"
            onClick={() => onStep('select')}
          >
            <ChevronLeftIcon fontSize="small" />
            {t('send_items_modal.back')}
          </Button>
        )}
        {step === 'select' ? (
          <Button
            type="button"
            variant="primary"
            disabled={!canContinue(transfers)}
            data-testid="send-continue"
            onClick={() => onStep('confirm')}
          >
            {t('send_items_modal.continue')}
            <ChevronRightIcon fontSize="small" />
          </Button>
        ) : (
          <Button type="button" variant="primary" loading={busy} data-testid="send-submit" onClick={onSubmit}>
            {t('send_items_modal.submit')}
          </Button>
        )}
      </Sell.Footer>
    </Modal>
  )
}

type SummaryProps = { bundle: RecipientBundle; items: Item[]; friends: Friend[] | undefined }

function RecipientSummary({ bundle, items, friends }: SummaryProps) {
  const { t } = useTranslation()
  const chosen = useMemo(() => items.filter(item => (bundle.amounts[item.id] ?? 0) > 0), [items, bundle])
  return (
    <S.RecipientCard data-testid={`send-summary-${bundle.address}`}>
      <RecipientLine address={bundle.address} friends={friends} />
      <S.Items>
        {chosen.map(item => {
          const thumbnailHash = item.contents[item.thumbnail]
          const stock = getStock(item)
          return (
            <S.ItemRow key={item.id}>
              <S.Thumb>
                <ItemThumbnail src={thumbnailHash ? getContentsStorageUrl(thumbnailHash) : null} rarity={item.rarity} />
              </S.Thumb>
              <S.ItemText>
                <S.ItemName title={item.name}>{item.name}</S.ItemName>
                <S.Label>{t('send_items_modal.available', { available: stock.available, total: stock.total })}</S.Label>
              </S.ItemText>
              <S.Amount data-testid={`send-summary-${bundle.address}-${item.id}`}>{bundle.amounts[item.id]}</S.Amount>
            </S.ItemRow>
          )
        })}
      </S.Items>
    </S.RecipientCard>
  )
}

function RecipientLine({ address, friends }: { address: string; friends: Friend[] | undefined }) {
  const friend = useMemo(() => friends?.find(candidate => candidate.address === address), [friends, address])
  const profile = useProfile(friend ? undefined : address)
  const name = friend?.name ?? profile.data?.name
  const avatar = friend?.avatarUrl ?? profile.data?.avatar?.snapshots?.face256
  return (
    <S.RecipientLine data-testid="send-summary-recipient">
      {avatar ? <Sell.Avatar src={avatar} alt="" /> : <Sell.AvatarFallback aria-hidden />}
      {name && <b>{name}</b>}
      <span title={address}>{name ? `(${address})` : address}</span>
    </S.RecipientLine>
  )
}

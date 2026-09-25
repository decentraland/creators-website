import { useMemo, useState } from 'react'
import {
  Add as AddIcon,
  ChevronRight as ChevronRightIcon,
  Remove as RemoveIcon,
  Star as StarIcon
} from '@mui/icons-material'
import { useTranslation } from '~/intl'
import { useCreditPacks } from '~/hooks/useCreditPacks'
import {
  MAX_PACK_QUANTITY,
  formatUsd,
  recommendPack,
  selectionTotals,
  type PackSelection,
  type PackTotals
} from '~/lib/creditPacks'
import { formatCredits } from '~/lib/publishFee'
import { Button } from '~/components/Button'
import { CurrencyAmount } from '~/components/CurrencyAmount'
import { Modal } from '~/components/Modal'
import { artForPack } from '../packArt'
import * as S from './BuyCreditsModal.styles'

// The catalogue has four packs; the placeholders keep the grid's shape while it loads.
const SKELETON_PACKS = 4

type Props = {
  balance: number
  /** Credits the creator is short of the fee; drives the preselected pack and quantity. */
  shortfall: number
  onCancel: () => void
  /** Starts the checkout; a rejection keeps the dialog open with an error line. */
  onBuy: (selection: PackSelection, totals: PackTotals) => Promise<void>
}

/**
 * The credit-pack picker stacked on the publish wizard: every pack, the recommended one preselected, and
 * the running total. While a single pack can cover the shortfall it is a plain one-pack picker; only when
 * none can does each pack grow a quantity stepper, since a checkout buys copies of a single pack.
 */
export function BuyCreditsModal({ balance, shortfall, onCancel, onBuy }: Props) {
  const { t } = useTranslation()
  const { packs: catalogue } = useCreditPacks()
  const packs = useMemo(() => catalogue ?? [], [catalogue])
  const recommended = useMemo(() => recommendPack(packs, shortfall), [packs, shortfall])
  const withQuantities = useMemo(() => !packs.some(pack => pack.credits >= shortfall), [packs, shortfall])
  const [chosen, setChosen] = useState<PackSelection | null>(null)
  const [isBuying, setBuying] = useState(false)
  const [failed, setFailed] = useState(false)
  const selection = chosen ?? recommended
  const totals = useMemo(() => selectionTotals(packs, selection), [packs, selection])
  const canBuy = totals.credits > 0 && !isBuying

  function setQuantity(packId: string, quantity: number) {
    setChosen(quantity > 0 ? { packId, quantity: Math.min(MAX_PACK_QUANTITY, quantity) } : { packId, quantity: 0 })
  }

  function quantityOf(packId: string): number {
    return selection?.packId === packId ? selection.quantity : 0
  }

  async function buy() {
    if (!selection || !canBuy) return
    setBuying(true)
    setFailed(false)
    try {
      await onBuy(selection, totals)
    } catch {
      setFailed(true)
      setBuying(false)
    }
  }

  return (
    <Modal
      title={t('publish_collection_modal.buy_credits.title')}
      size="large"
      hideTitle
      showClose
      closeDisabled={isBuying}
      onClose={onCancel}
      testId="buy-credits-modal"
    >
      <S.Wrap>
        <S.Header>
          <S.Heading>{t('publish_collection_modal.buy_credits.title')}</S.Heading>
          <S.Balance data-testid="buy-credits-balance">
            {t('publish_collection_modal.buy_credits.balance')}{' '}
            <span>
              <CurrencyAmount currency="credits">{formatCredits(balance)}</CurrencyAmount>
            </span>
          </S.Balance>
        </S.Header>

        <S.Packs data-testid="credit-packs" aria-busy={!catalogue || undefined}>
          {!catalogue &&
            Array.from({ length: SKELETON_PACKS }, (_, index) => (
              <S.Pack key={index} data-skeleton data-testid="credit-pack-skeleton" aria-hidden>
                <S.Credits>
                  <S.SkeletonLine className="skeleton" data-size="amount" />
                  <S.SkeletonLine className="skeleton" data-size="label" />
                </S.Credits>
                <S.SkeletonArt className="skeleton" />
                <S.SkeletonLine className="skeleton" data-size="price" />
              </S.Pack>
            ))}
          {packs.map((pack, index) => {
            const quantity = quantityOf(pack.id)
            return (
              <S.Pack
                key={pack.id}
                role="button"
                tabIndex={0}
                data-testid={`credit-pack-${pack.id}`}
                data-selected={quantity > 0 || undefined}
                data-disabled={isBuying || undefined}
                aria-pressed={quantity > 0}
                aria-label={t('publish_collection_modal.buy_credits.pack_label', {
                  credits: formatCredits(pack.credits),
                  usd: formatUsd(pack.usd)
                })}
                onClick={() => quantity === 0 && setQuantity(pack.id, 1)}
                onKeyDown={event => {
                  if ((event.key === 'Enter' || event.key === ' ') && quantity === 0) {
                    event.preventDefault()
                    setQuantity(pack.id, 1)
                  }
                }}
              >
                {recommended?.packId === pack.id && (
                  <S.Badge data-testid="credit-pack-recommended" aria-hidden>
                    <StarIcon />
                    {t('publish_collection_modal.buy_credits.recommended')}
                  </S.Badge>
                )}
                <S.Credits>
                  <S.CreditsAmount>
                    <CurrencyAmount currency="credits">{formatCredits(pack.credits)}</CurrencyAmount>
                  </S.CreditsAmount>
                  <S.CreditsLabel>{t('publish_collection_modal.buy_credits.credits')}</S.CreditsLabel>
                </S.Credits>
                <S.Art src={artForPack(pack, index)} alt="" />
                <S.Price>{formatUsd(pack.usd)}</S.Price>
                {withQuantities && (
                  <S.Stepper onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
                    <S.StepButton
                      type="button"
                      disabled={quantity === 0 || isBuying}
                      aria-label={t('publish_collection_modal.buy_credits.decrease', {
                        credits: formatCredits(pack.credits)
                      })}
                      data-testid={`credit-pack-${pack.id}-decrease`}
                      onClick={() => setQuantity(pack.id, quantity - 1)}
                    >
                      <RemoveIcon />
                    </S.StepButton>
                    <span data-testid={`credit-pack-${pack.id}-quantity`}>{quantity}</span>
                    <S.StepButton
                      type="button"
                      disabled={quantity >= MAX_PACK_QUANTITY || isBuying}
                      aria-label={t('publish_collection_modal.buy_credits.increase', {
                        credits: formatCredits(pack.credits)
                      })}
                      data-testid={`credit-pack-${pack.id}-increase`}
                      onClick={() => setQuantity(pack.id, quantity + 1)}
                    >
                      <AddIcon />
                    </S.StepButton>
                  </S.Stepper>
                )}
              </S.Pack>
            )
          })}
        </S.Packs>

        <S.Total data-testid="buy-credits-total">
          {t('publish_collection_modal.buy_credits.total')}
          <span>
            <CurrencyAmount currency="credits">{formatCredits(totals.credits)}</CurrencyAmount>
          </span>
          <span data-testid="buy-credits-total-usd">{formatUsd(totals.usd)}</span>
        </S.Total>
        {failed && (
          <S.ErrorText data-testid="buy-credits-error">{t('publish_collection_modal.buy_credits.error')}</S.ErrorText>
        )}

        <S.Footer>
          <Button
            type="button"
            variant="secondary"
            disabled={isBuying}
            data-testid="buy-credits-cancel"
            onClick={onCancel}
          >
            {t('publish_collection_modal.buy_credits.cancel')}
          </Button>
          <Button
            type="button"
            loading={isBuying}
            disabled={!canBuy}
            data-testid="buy-credits-submit"
            onClick={() => void buy()}
          >
            {t('publish_collection_modal.buy_credits.buy', { credits: formatCredits(totals.credits) })}
            <ChevronRightIcon fontSize="small" />
          </Button>
        </S.Footer>
      </S.Wrap>
    </Modal>
  )
}

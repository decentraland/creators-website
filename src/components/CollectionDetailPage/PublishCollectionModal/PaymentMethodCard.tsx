import { Check as CheckIcon } from '@mui/icons-material'
import { useTranslation } from '~/intl'
import { Button } from '~/components/Button'
import { CurrencyAmount } from '~/components/CurrencyAmount'
import { openExternal } from '~/lib/navigation'
import { type PaymentMethod } from '~/lib/publishCollection'
import creditsMark from '~/assets/payment/credits-logo.webp'
import manaMark from '~/assets/payment/mana-logo.webp'
import * as Shared from './PublishCollectionModal.styles'
import * as S from './PaymentMethodCard.styles'

const MARKS: Record<PaymentMethod, string> = { credits: creditsMark, mana: manaMark }

type Props = {
  method: PaymentMethod
  price: string
  balance: string
  /** Extra line under the price (e.g. the MANA-per-credit rate). */
  note?: string
  hasEnough: boolean
  getMoreUrl: string
  selected: boolean
  /** Hidden when it's the only method: a lone card is always the selection. */
  showCheckbox: boolean
  /** With several cards the buy button reads just "Buy"; alone it names the currency. */
  compactBuy: boolean
  disabled: boolean
  onSelect: () => void
}

export function PaymentMethodCard({
  method,
  price,
  balance,
  note,
  hasEnough,
  getMoreUrl,
  selected,
  showCheckbox,
  compactBuy,
  disabled,
  onSelect
}: Props) {
  const { t } = useTranslation()
  const isDisabled = disabled || !hasEnough
  // An auto-selected lone method with no balance must not look chosen.
  const isSelected = selected && hasEnough

  return (
    <S.Card
      data-testid={`payment-method-${method}`}
      data-method={method}
      data-selected={isSelected || undefined}
      data-disabled={isDisabled || undefined}
    >
      <input
        type="radio"
        name="payment-method"
        value={method}
        checked={isSelected}
        disabled={isDisabled}
        data-testid={`payment-method-${method}-input`}
        onChange={onSelect}
      />
      {showCheckbox && (
        <Shared.CheckboxBox aria-hidden data-checked={isSelected || undefined}>
          <CheckIcon />
        </Shared.CheckboxBox>
      )}
      <S.Mark src={MARKS[method]} alt="" />
      <S.Info>
        <S.Title>{t(`publish_collection_modal.payment_step.${method}`)}</S.Title>
        <S.Balance data-insufficient={hasEnough ? undefined : true} data-testid={`payment-method-${method}-balance`}>
          {t(`publish_collection_modal.payment_step.${method}_balance`)}{' '}
          <span>
            <CurrencyAmount currency={method}>{balance}</CurrencyAmount>
          </span>
        </S.Balance>
      </S.Info>
      <S.Price>
        <S.Amount data-testid={`payment-method-${method}-price`}>
          <CurrencyAmount currency={method}>{price}</CurrencyAmount>
        </S.Amount>
        {note && <S.Rate>{note}</S.Rate>}
      </S.Price>
      {!hasEnough && (
        <Button
          as="a"
          variant="gradient"
          size="sm"
          href={getMoreUrl}
          data-testid={`payment-method-${method}-buy`}
          onClick={(event: React.MouseEvent) => {
            event.preventDefault()
            openExternal(getMoreUrl)
          }}
        >
          <CurrencyAmount currency={method}>
            {t(
              compactBuy
                ? 'publish_collection_modal.payment_step.buy'
                : `publish_collection_modal.payment_step.buy_${method}`
            )}
          </CurrencyAmount>
        </Button>
      )}
    </S.Card>
  )
}

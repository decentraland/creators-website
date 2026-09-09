import { type CSSProperties, type ReactNode } from 'react'
import { Check as CheckIcon } from '@mui/icons-material'
import { useTranslation } from '~/intl'
import { Button } from '~/components/Button'
import { openExternal } from '~/lib/navigation'
import { type PaymentMethod } from '~/lib/publishCollection'
import creditsMark from '~/assets/payment/credits-logo.webp'
import manaMark from '~/assets/payment/mana-logo.webp'
import creditsGlyph from '~/assets/icons/credits.svg'
import manaGlyph from '~/assets/icons/mana-matic.svg'
import * as Shared from './PublishCollectionModal.styles'
import * as S from './PaymentMethodCard.styles'

const GLYPHS: Record<PaymentMethod, string> = { credits: creditsGlyph, mana: manaGlyph }
const MARKS: Record<PaymentMethod, string> = { credits: creditsMark, mana: manaMark }

type CurrencyProps = {
  method: PaymentMethod
  children: ReactNode
}

/** An amount prefixed with its currency glyph — "Ⓒ 300" / "◈ 500". */
export function CurrencyAmount({ method, children }: CurrencyProps) {
  return (
    <>
      <S.CurrencyMark aria-hidden style={{ '--icon-url': `url("${GLYPHS[method]}")` } as CSSProperties} />
      {children}
    </>
  )
}

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
            <CurrencyAmount method={method}>{balance}</CurrencyAmount>
          </span>
        </S.Balance>
      </S.Info>
      <S.Price>
        <S.Amount data-testid={`payment-method-${method}-price`}>
          <CurrencyAmount method={method}>{price}</CurrencyAmount>
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
          <CurrencyAmount method={method}>
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

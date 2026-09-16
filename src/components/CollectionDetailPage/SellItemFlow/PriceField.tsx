import { useMemo } from 'react'
import { useTranslation } from '~/intl'
import { useManaUsdRate } from '~/hooks/useSales'
import { formatCredits, formatMana } from '~/lib/publishFee'
import {
  MAX_SALE_CREDITS,
  MAX_SALE_MANA_WEI,
  MIN_SALE_MANA_WEI,
  formatCreditsAsUsd,
  formatManaAsUsd,
  parseManaAmount,
  sanitizeManaInput,
  type PriceCurrency
} from '~/lib/sales'
import { CurrencyAmount } from '~/components/CurrencyAmount'
import { Select, type SelectOption } from '~/components/Select'
import * as S from './SellItemModal.styles'

export type PriceFormValues = {
  currency: PriceCurrency
  /** As typed: whole credits, or MANA with up to two decimals. */
  amount: string
}

type Props = {
  label: string
  values: PriceFormValues
  onChange: (values: PriceFormValues) => void
  /** A giveaway: the amount is frozen at 0 and the currency can't be picked. */
  free?: boolean
  disabled?: boolean
  /** Prefix of the field's test ids: `-input`, `-usd`, `-rate`, `-currency`, `-error`. */
  testId: string
}

const ONE_MANA = 10n ** 18n

/**
 * Amount input whose leading currency glyph is the picker (credits or MANA), with a USD equivalent:
 * fixed for credits, estimated from the marketplace's MANA/USD oracle for MANA. Rendered inside the caller's field.
 */
export function PriceField({ label, values, onChange, free = false, disabled = false, testId }: Props) {
  const { t } = useTranslation()
  const { currency, amount } = values
  const rate = useManaUsdRate(currency === 'mana' && !free)

  const options = useMemo<SelectOption<PriceCurrency>[]>(
    () => [
      {
        value: 'credits',
        label: t('sell_item_modal.price.currency_credits'),
        icon: <CurrencyAmount currency="credits">{null}</CurrencyAmount>
      },
      {
        value: 'mana',
        label: t('sell_item_modal.price.currency_mana'),
        icon: <CurrencyAmount currency="mana">{null}</CurrencyAmount>
      }
    ],
    [t]
  )

  const credits = Number(amount) || 0
  const manaWei = useMemo(() => parseManaAmount(amount), [amount])

  let error: string | null = null
  if (!free && currency === 'credits' && credits > Number(MAX_SALE_CREDITS)) {
    error = t('sell_item_modal.price.too_high', { max: formatCredits(Number(MAX_SALE_CREDITS)) })
  } else if (!free && currency === 'mana' && manaWei !== null) {
    if (manaWei > MAX_SALE_MANA_WEI) {
      error = t('sell_item_modal.price.too_high_mana', { max: formatMana(MAX_SALE_MANA_WEI) })
    } else if (manaWei < MIN_SALE_MANA_WEI) {
      error = t('sell_item_modal.price.too_low_mana', { min: formatMana(MIN_SALE_MANA_WEI) })
    }
  }

  let usd: string
  if (free) usd = formatCreditsAsUsd(0)
  else if (currency === 'credits') usd = formatCreditsAsUsd(credits)
  else usd = rate.data !== undefined && manaWei !== null ? `≈ ${formatManaAsUsd(manaWei, rate.data)}` : ''

  function changeAmount(value: string) {
    onChange({ currency, amount: currency === 'credits' ? value.replace(/\D/g, '') : sanitizeManaInput(value) })
  }

  function changeCurrency(next: PriceCurrency) {
    // A typed amount means a different number in the other unit: never carry it over.
    if (next !== currency) onChange({ currency: next, amount: '' })
  }

  return (
    <>
      <S.Label>{label}</S.Label>
      <S.Box data-disabled={free || undefined} data-invalid={error !== null || undefined}>
        <Select
          value={currency}
          options={options}
          onChange={changeCurrency}
          variant="glyph"
          disabled={free || disabled}
          ariaLabel={t('sell_item_modal.price.currency_label')}
          testId={`${testId}-currency`}
        />
        <input
          type="text"
          inputMode={currency === 'credits' ? 'numeric' : 'decimal'}
          aria-label={label}
          placeholder="0"
          value={free ? '0' : amount}
          disabled={free || disabled}
          data-testid={`${testId}-input`}
          data-currency={currency}
          onChange={event => changeAmount(event.target.value)}
        />
        {usd && <S.Usd data-testid={`${testId}-usd`}>{usd}</S.Usd>}
      </S.Box>
      <S.Rate data-testid={`${testId}-rate`}>
        {currency === 'credits' || free
          ? t('sell_item_modal.price.rate', { usd: formatCreditsAsUsd(1) })
          : rate.data !== undefined
            ? t('sell_item_modal.price.mana_rate', { usd: formatManaAsUsd(ONE_MANA, rate.data) })
            : t('sell_item_modal.price.mana_min', { min: formatMana(MIN_SALE_MANA_WEI) })}
      </S.Rate>
      {error && <S.ErrorText data-testid={`${testId}-error`}>{error}</S.ErrorText>}
    </>
  )
}

export const DEFAULT_PRICE_VALUES: PriceFormValues = { currency: 'credits', amount: '' }

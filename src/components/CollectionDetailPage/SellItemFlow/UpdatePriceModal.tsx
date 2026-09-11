import { useState, type FormEvent } from 'react'
import { useTranslation } from '~/intl'
import { type Item } from '~/lib/items'
import { formatCredits } from '~/lib/publishFee'
import { MAX_SALE_CREDITS, formatCreditsAsUsd, isValidCredits } from '~/lib/sales'
import { Button } from '~/components/Button'
import { CurrencyAmount } from '~/components/CurrencyAmount'
import { Modal } from '~/components/Modal'
import { SellItemCard } from './SellItemCard'
import * as S from './SellItemModal.styles'

type Props = {
  item: Item
  /** The listing's current price, so the same number can't be "updated" to itself. */
  currentCredits: number | null
  initialCredits?: string
  onSubmit: (credits: number) => void
  onClose: () => void
}

/** Edit Price: one field for the new credits price; beneficiary and expiration carry over from the listing. */
export function UpdatePriceModal({ item, currentCredits, initialCredits = '', onSubmit, onClose }: Props) {
  const { t } = useTranslation()
  const [credits, setCredits] = useState(initialCredits)
  const value = Number(credits)
  const priceTooHigh = value > Number(MAX_SALE_CREDITS)
  const canSubmit = isValidCredits(value) && value !== currentCredits

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (canSubmit) onSubmit(value)
  }

  return (
    <Modal title={t('sell_item_modal.update_price.title')} onClose={onClose} testId="update-price-modal">
      <S.Divider />
      <S.Form onSubmit={handleSubmit} data-testid="update-price-form">
        <S.Fields>
          <SellItemCard item={item} showAvailability />
          <S.Field>
            <S.Label>{t('sell_item_modal.update_price.price_label')}</S.Label>
            <S.Box data-invalid={priceTooHigh || undefined}>
              <S.Glyph aria-hidden>
                <CurrencyAmount currency="credits">{null}</CurrencyAmount>
              </S.Glyph>
              <input
                type="text"
                inputMode="numeric"
                aria-label={t('sell_item_modal.update_price.price_label')}
                placeholder="0"
                value={credits}
                data-testid="update-price-input"
                onChange={event => setCredits(event.target.value.replace(/\D/g, ''))}
              />
              <S.Usd data-testid="update-price-usd">{formatCreditsAsUsd(value || 0)}</S.Usd>
            </S.Box>
            <S.Rate>{t('sell_item_modal.price.rate', { usd: formatCreditsAsUsd(1) })}</S.Rate>
            {priceTooHigh && (
              <S.ErrorText data-testid="update-price-error">
                {t('sell_item_modal.price.too_high', { max: formatCredits(Number(MAX_SALE_CREDITS)) })}
              </S.ErrorText>
            )}
          </S.Field>
        </S.Fields>
        <S.Footer>
          <Button type="button" variant="secondary" data-testid="update-price-cancel" onClick={onClose}>
            {t('sell_item_modal.cancel')}
          </Button>
          <Button type="submit" disabled={!canSubmit} data-testid="update-price-submit">
            {t('sell_item_modal.update_price.submit')}
          </Button>
        </S.Footer>
      </S.Form>
    </Modal>
  )
}

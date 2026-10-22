import { useMemo } from 'react'
import { ChevronLeft as ChevronLeftIcon } from '@mui/icons-material'
import { useIntl } from 'react-intl'
import { config } from '~/config'
import { useTranslation } from '~/intl'
import { useManaBalance } from '~/hooks/useBalances'
import { type Session } from '~/lib/auth'
import { type Collection } from '~/lib/collections'
import { type Item } from '~/lib/items'
import { openExternal } from '~/lib/navigation'
import { formatMana, weiToUsdCents } from '~/lib/publishFee'
import { getLinkedPublishQuote, type LinkedSlots } from '~/lib/publishLinkedItems'
import { type ThirdPartyPrice } from '~/lib/thirdPartyRegistry'
import { type ThirdParty } from '~/lib/thirdParty'
import { Button } from '~/components/Button'
import { Checkbox } from '~/components/Checkbox'
import { CurrencyAmount } from '~/components/CurrencyAmount'
import { PaymentMethodCard } from '../../PublishCollectionModal/PaymentMethodCard'
import * as S from '../../PublishCollectionModal/PublishCollectionModal.styles'

const SUMMARY_COLUMNS = 'minmax(0, 2fr) minmax(80px, 1fr) minmax(90px, 1fr) minmax(120px, 1fr)'

type Props = {
  collection: Collection
  thirdParty: ThirdParty
  session: Session
  itemsToPublish: Item[]
  itemsToPush: Item[]
  isProgrammatic: boolean
  price: ThirdPartyPrice | undefined
  priceError: boolean
  onRetryPrice: () => void
  slots: LinkedSlots | undefined
  slotsError: boolean
  /** The fee went up since it was shown: Submit now confirms the new one. */
  feeChanged: boolean
  onRetrySlots: () => void
  /** An earlier attempt sent a payment: it is confirmed first, and only what is still missing is charged. */
  resuming: boolean
  /** A run is starting or running: Submit must not start a second one. */
  busy: boolean
  accepted: boolean
  onAcceptedChange: (accepted: boolean) => void
  onBack: () => void
  onSubmit: () => void
}

/** Last step: the slots to buy and their MANA price, the wallet's balance, the terms, and the submit itself. */
export function LinkedPaymentStep({
  collection,
  thirdParty,
  session,
  itemsToPublish,
  itemsToPush,
  isProgrammatic,
  price,
  priceError,
  onRetryPrice,
  slots,
  slotsError,
  feeChanged,
  onRetrySlots,
  resuming,
  busy,
  accepted,
  onAcceptedChange,
  onBack,
  onSubmit
}: Props) {
  const { t } = useTranslation()
  const intl = useIntl()
  const mana = useManaBalance(session.address)

  const quote = useMemo(
    () =>
      price && slots
        ? getLinkedPublishQuote(itemsToPublish.length, slots, price, {
            isProgrammatic,
            published: thirdParty.published
          })
        : null,
    [price, slots, itemsToPublish.length, isProgrammatic, thirdParty.published]
  )
  const slotsToBuy = quote?.slotsToBuy ?? null
  const fee = quote?.fee ?? null
  const isRegistered = thirdParty.published || !!slots?.registered
  const balance = mana.data ?? 0n
  const hasEnough = !!fee && balance >= fee.maxManaWei
  const isFree = !!fee && fee.manaWei === 0n
  const usd = (wei: bigint) => intl.formatNumber(weiToUsdCents(wei) / 100, { style: 'currency', currency: 'USD' })
  const loadError = priceError || slotsError
  const canSubmit = !busy && accepted && !loadError && !!fee && (isFree || resuming || (hasEnough && mana.isSuccess))

  const openLink = (url: string) => (event: React.MouseEvent) => {
    event.preventDefault()
    openExternal(url)
  }

  return (
    <S.Step data-testid="publish-linked-payment-step">
      <S.Fields>
        <div>
          <S.Heading>{t('publish_linked_modal.payment_step.title')}</S.Heading>
          <S.Text>
            {t('publish_linked_modal.payment_step.description', {
              count: itemsToPublish.length,
              pushed: itemsToPush.length,
              name: collection.name
            })}
          </S.Text>
        </div>

        {loadError ? (
          <S.InlineNote data-testid="publish-linked-fee-error">
            {t('publish_linked_modal.payment_step.price_error')}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                if (priceError) onRetryPrice()
                if (slotsError) onRetrySlots()
              }}
            >
              {t('publish_collection_modal.payment_step.retry')}
            </Button>
          </S.InlineNote>
        ) : !fee || slotsToBuy === null ? (
          <S.InlineNote data-testid="publish-linked-fee-loading">
            <S.Spinner aria-hidden />
          </S.InlineNote>
        ) : (
          <>
            <S.SummaryTable>
              <S.TableHeader style={{ gridTemplateColumns: SUMMARY_COLUMNS }}>
                <span>{t('publish_collection_modal.payment_step.columns.collection')}</span>
                <span>{t('publish_collection_modal.payment_step.columns.items')}</span>
                <span>{t('publish_linked_modal.payment_step.columns.slots')}</span>
                <span>{t('publish_collection_modal.payment_step.columns.total_fee')}</span>
              </S.TableHeader>
              <S.SummaryRow style={{ gridTemplateColumns: SUMMARY_COLUMNS }} data-testid="publish-linked-summary">
                <S.SummaryName>
                  <span title={collection.name}>{collection.name}</span>
                </S.SummaryName>
                <span data-testid="publish-linked-summary-items">
                  {t('publish_collection_modal.payment_step.items_count', { count: itemsToPublish.length })}
                </span>
                <span data-testid="publish-linked-summary-slots">{slotsToBuy}</span>
                <S.SummaryTotal data-testid="publish-linked-summary-total">
                  {isFree ? (
                    t('publish_linked_modal.payment_step.free')
                  ) : (
                    <>
                      <CurrencyAmount currency="mana">{formatMana(fee.manaWei)}</CurrencyAmount>
                      <S.FeeTerm as="span"> · {usd(fee.usdWei)}</S.FeeTerm>
                    </>
                  )}
                </S.SummaryTotal>
              </S.SummaryRow>
            </S.SummaryTable>
            {resuming && (
              <S.InlineNote data-testid="publish-linked-resuming">
                {t('publish_linked_modal.payment_step.resuming')}
              </S.InlineNote>
            )}
            {feeChanged && (
              <S.InlineNote data-testid="publish-linked-fee-changed">
                {t('publish_linked_modal.payment_step.fee_changed')}
              </S.InlineNote>
            )}
            <S.Text data-testid="publish-linked-fee-note">
              {isProgrammatic
                ? isRegistered
                  ? t('publish_linked_modal.payment_step.programmatic_published')
                  : t('publish_linked_modal.payment_step.programmatic_first', { slots: price!.programmaticMinSlots })
                : t('publish_linked_modal.payment_step.standard_note', {
                    price: usd(price!.itemSlotUsdWei),
                    available: slots?.available ?? 0
                  })}
            </S.Text>
            {!isFree && (
              <S.PaymentMethods>
                <S.Lead as="h4">{t('publish_collection_modal.payment_step.payment_method')}</S.Lead>
                <PaymentMethodCard
                  method="mana"
                  price={formatMana(fee.manaWei)}
                  balance={formatMana(balance)}
                  hasEnough={hasEnough}
                  getMoreUrl={config.get('ACCOUNT_URL')}
                  selected
                  showCheckbox={false}
                  compactBuy={false}
                  disabled={false}
                  onSelect={() => undefined}
                />
              </S.PaymentMethods>
            )}
          </>
        )}

        <Checkbox checked={accepted} onChange={onAcceptedChange} testId="publish-linked-terms-accept">
          {intl.formatMessage(
            { id: 'publish_linked_modal.payment_step.checkbox' },
            {
              terms: chunks => (
                <a href={config.get('TERMS_OF_USE_URL')} onClick={openLink(config.get('TERMS_OF_USE_URL'))}>
                  {chunks}
                </a>
              ),
              policy: chunks => (
                <a href={config.get('CONTENT_POLICY_URL')} onClick={openLink(config.get('CONTENT_POLICY_URL'))}>
                  {chunks}
                </a>
              )
            }
          )}
        </Checkbox>
      </S.Fields>
      <S.Footer>
        <Button type="button" variant="secondary" data-testid="publish-back" onClick={onBack}>
          <ChevronLeftIcon fontSize="small" />
          {t('publish_collection_modal.back')}
        </Button>
        <Button type="button" disabled={!canSubmit} data-testid="publish-linked-submit" onClick={onSubmit}>
          {t(
            resuming
              ? 'publish_linked_modal.payment_step.submit_resume'
              : isFree
                ? 'publish_linked_modal.payment_step.submit_free'
                : 'publish_linked_modal.payment_step.submit'
          )}
        </Button>
      </S.Footer>
    </S.Step>
  )
}

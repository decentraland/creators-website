import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft as ChevronLeftIcon } from '@mui/icons-material'
import { useIntl } from 'react-intl'
import { config } from '~/config'
import { useTranslation } from '~/intl'
import { useProfile } from '~/hooks/useProfile'
import { useCreditsBalance, useManaBalance } from '~/hooks/useBalances'
import { useFeatureFlag } from '~/hooks/useFeatureFlag'
import { useApproveMana, useManaAllowance, usePublishCollection, useRarities } from '~/hooks/usePublishCollection'
import { useBeforeUnloadGuard } from '~/hooks/useBeforeUnloadGuard'
import { track } from '~/lib/analytics'
import { type Session } from '~/lib/auth'
import { getContentsStorageUrl } from '~/lib/builder'
import { type Collection } from '~/lib/collections'
import { FeatureFlag } from '~/lib/featureFlags'
import { type Item } from '~/lib/items'
import { createCreditsCheckout } from '~/lib/credits'
import { type PackSelection, selectionTotals } from '~/lib/creditPacks'
import { saveTopUpResume } from '~/lib/creditsTopUp'
import { openExternal, redirectExternal } from '~/lib/navigation'
import { verifyPublicationFee } from '~/lib/feeVerification'
import {
  canPayWith,
  getAvailablePaymentMethods,
  getMaticChainId,
  toPublishError,
  type PaymentMethod,
  type PublishCollectionError,
  type PublishResult
} from '~/lib/publishCollection'
import { formatCredits, formatMana, getPublicationFee } from '~/lib/publishFee'
import { Button } from '~/components/Button'
import { InfoTooltip } from '~/components/Tooltip'
import { Checkbox } from '~/components/Checkbox'
import { ThumbnailMosaic } from '~/components/ThumbnailMosaic'
import { CurrencyAmount } from '~/components/CurrencyAmount'
import { useCreditPacks } from '~/hooks/useCreditPacks'
import { BuyCreditsModal } from './BuyCreditsModal'
import { PaymentMethodCard } from './PaymentMethodCard'
import { Methods } from './PaymentMethodCard.styles'
import * as S from './PublishCollectionModal.styles'

const SUMMARY_COLUMNS = 'minmax(0, 2fr) 1fr 1fr 1fr'
// Anchors keep their href for a11y; navigation goes through the host-facing helper.
const openLink = (url: string) => (event: React.MouseEvent) => {
  event.preventDefault()
  openExternal(url)
}

type Status = 'idle' | 'checking' | 'approving' | 'confirming'

type Props = {
  collection: Collection
  items: Item[]
  session: Session
  paymentMethod: PaymentMethod | null
  onPaymentMethodChange: (method: PaymentMethod) => void
  accepted: boolean
  onAcceptedChange: (accepted: boolean) => void
  onBusyChange: (busy: boolean) => void
  onBack: () => void
  onPublished: (result: PublishResult) => void
  onFailed: (error: PublishCollectionError) => void
}

/** Step 3: fee summary, payment method, terms — and the publish transaction itself. */
export function PaymentStep({
  collection,
  items,
  session,
  paymentMethod,
  onPaymentMethodChange,
  accepted,
  onAcceptedChange,
  onBusyChange,
  onBack,
  onPublished,
  onFailed
}: Props) {
  const { t } = useTranslation()
  const intl = useIntl()
  const { address } = session

  const rarities = useRarities(address)
  const credits = useCreditsBalance(address)
  const mana = useManaBalance(address)
  const profile = useProfile(address)
  const fee = useMemo(() => getPublicationFee(rarities.data ?? [], items.length), [rarities.data, items.length])

  const creditsFlag = useFeatureFlag(FeatureFlag.SHOP_CREDITS_FOR_COLLECTIONS_FEE)
  const { packs } = useCreditPacks()
  const methods = useMemo(
    () => getAvailablePaymentMethods(mana.data, creditsFlag.enabled),
    [mana.data, creditsFlag.enabled]
  )
  const allowance = useManaAllowance(address, methods.includes('mana'))
  const approve = useApproveMana(session)
  const publish = usePublishCollection(session)

  const [status, setStatus] = useState<Status>('idle')
  const [approveFailed, setApproveFailed] = useState(false)
  const [isBuyingCredits, setBuyingCredits] = useState(false)
  const isSubmitting = status !== 'idle'

  useEffect(() => {
    onBusyChange(isSubmitting)
  }, [isSubmitting, onBusyChange])
  // A wallet prompt is pending: leaving the page now would orphan the transaction.
  useBeforeUnloadGuard(isSubmitting)

  // A lone method is the selection; a vanished one (balance refetch) falls back to the first available.
  // The still-unread flag would offer a list the creator never sees, so nothing is selected until it lands.
  useEffect(() => {
    if (creditsFlag.isLoading) return
    if (paymentMethod && !methods.includes(paymentMethod)) onPaymentMethodChange(methods[0])
    else if (!paymentMethod && methods.length === 1) onPaymentMethodChange(methods[0])
  }, [methods, paymentMethod, onPaymentMethodChange, creditsFlag.isLoading])

  const balances = { credits: credits.data?.credits ?? 0, manaWei: mana.data ?? 0n }
  const creditsShortfall = Math.max(0, (fee?.total.credits ?? 0) - balances.credits)
  const selectedIsPayable =
    !!fee && !!paymentMethod && methods.includes(paymentMethod) && canPayWith(paymentMethod, fee, balances)
  const canSubmit = selectedIsPayable && accepted && !isSubmitting && !credits.isLoading && !creditsFlag.isLoading

  async function handleSubmit() {
    if (!fee || !paymentMethod || !canSubmit) return
    setApproveFailed(false)
    // The quote is builder-server's word; the contract's own price decides whether a wallet prompt is warranted.
    setStatus('checking')
    try {
      await verifyPublicationFee(fee, items, getMaticChainId())
    } catch (error) {
      setStatus('idle')
      void rarities.refetch()
      onFailed(toPublishError(error))
      return
    }
    if (paymentMethod === 'mana' && (allowance.data ?? 0n) < fee.total.manaWei) {
      setStatus('approving')
      try {
        await approve.mutateAsync(fee.total.manaWei)
      } catch (error) {
        setStatus('idle')
        if (toPublishError(error).reason !== 'rejected') setApproveFailed(true)
        return
      }
    }
    setStatus('confirming')
    publish.mutate(
      { collection, items, paymentMethod, fee, email: profile.data?.email?.trim() || null },
      {
        onSuccess: onPublished,
        onError: error => {
          setStatus('idle')
          const publishError = toPublishError(error)
          // A wallet rejection is the creator changing their mind, not a failure to report.
          if (publishError.reason !== 'rejected') onFailed(publishError)
        }
      }
    )
  }

  function openBuyCredits() {
    track('Open buy credits', { collectionId: collection.id, shortfall: creditsShortfall })
    setBuyingCredits(true)
  }

  // Leaves for Stripe's hosted page; the hand-off record brings the creator back to this step.
  async function buyCredits(selection: PackSelection) {
    const totals = selectionTotals(packs ?? [], selection)
    const checkout = await createCreditsCheckout(address, selection)
    saveTopUpResume({ collectionId: collection.id, orderId: checkout.orderId, paymentMethod, termsAccepted: accepted })
    track('Start credits checkout', {
      collectionId: collection.id,
      orderId: checkout.orderId,
      packId: selection.packId,
      quantity: selection.quantity,
      credits: totals.credits,
      usd: totals.usd,
      shortfall: creditsShortfall
    })
    redirectExternal(checkout.url)
  }

  const thumbnails = useMemo(
    () =>
      items
        .slice(0, 4)
        .map(item => ({ url: getContentsStorageUrl(item.contents[item.thumbnail]), rarity: item.rarity })),
    [items]
  )

  return (
    <S.Step data-testid="publish-payment-step">
      <S.Fields
        data-busy={isSubmitting || undefined}
        aria-busy={isSubmitting || undefined}
        {...(isSubmitting ? { inert: '' } : {})}
      >
        <div>
          <S.Heading>{t('publish_collection_modal.payment_step.title')}</S.Heading>
          <S.Text>
            {intl.formatMessage(
              { id: 'publish_collection_modal.payment_step.description' },
              {
                count: items.length,
                name: collection.name,
                fee: chunks => (
                  <S.FeeTerm>
                    {chunks}
                    <InfoTooltip
                      content={
                        <>
                          <strong>{t('publish_collection_modal.payment_step.fee_tooltip_title')}</strong>
                          {'\n'}
                          {t('publish_collection_modal.payment_step.fee_tooltip_body')}
                        </>
                      }
                      testId="publish-fee-tooltip"
                    />
                  </S.FeeTerm>
                )
              }
            )}
          </S.Text>
        </div>

        <S.SummaryTable>
          <S.TableHeader style={{ gridTemplateColumns: SUMMARY_COLUMNS }}>
            <span>{t('publish_collection_modal.payment_step.columns.collection')}</span>
            <span>{t('publish_collection_modal.payment_step.columns.items')}</span>
            <span>{t('publish_collection_modal.payment_step.columns.fee_per_item')}</span>
            <span>{t('publish_collection_modal.payment_step.columns.total_fee')}</span>
          </S.TableHeader>
          <S.SummaryRow style={{ gridTemplateColumns: SUMMARY_COLUMNS }} data-testid="publish-summary">
            <S.SummaryName>
              <S.MosaicFrame aria-hidden>
                <ThumbnailMosaic thumbnails={thumbnails} testId="publish-summary-mosaic" />
              </S.MosaicFrame>
              <span title={collection.name}>{collection.name}</span>
            </S.SummaryName>
            <span data-testid="publish-summary-items">
              {t('publish_collection_modal.payment_step.items_count', { count: items.length })}
            </span>
            <span data-testid="publish-summary-fee-per-item">
              {fee ? <CurrencyAmount currency="credits">{formatCredits(fee.perItem.credits)}</CurrencyAmount> : '—'}
            </span>
            <S.SummaryTotal data-testid="publish-summary-total">
              {fee ? <CurrencyAmount currency="credits">{formatCredits(fee.total.credits)}</CurrencyAmount> : '—'}
            </S.SummaryTotal>
          </S.SummaryRow>
        </S.SummaryTable>

        <S.PaymentMethods>
          <S.Lead as="h4">{t('publish_collection_modal.payment_step.payment_method')}</S.Lead>
          {rarities.isError ? (
            <S.InlineNote data-testid="publish-fee-error">
              {t('publish_collection_modal.payment_step.fee_error')}
              <Button type="button" variant="secondary" size="sm" onClick={() => void rarities.refetch()}>
                {t('publish_collection_modal.payment_step.retry')}
              </Button>
            </S.InlineNote>
          ) : !fee || creditsFlag.isLoading ? (
            <S.InlineNote data-testid="publish-fee-loading">
              <S.Spinner aria-hidden />
            </S.InlineNote>
          ) : (
            <Methods data-testid="payment-methods" data-disabled={isSubmitting || undefined}>
              {methods.map(method => (
                <PaymentMethodCard
                  key={method}
                  method={method}
                  price={method === 'credits' ? formatCredits(fee.total.credits) : formatMana(fee.total.manaWei)}
                  balance={method === 'credits' ? formatCredits(balances.credits) : formatMana(balances.manaWei)}
                  note={
                    method === 'mana'
                      ? t('publish_collection_modal.payment_step.rate', {
                          mana: formatMana(fee.manaPerCredit)
                        })
                      : undefined
                  }
                  hasEnough={canPayWith(method, fee, balances)}
                  getMoreUrl={method === 'credits' ? `${config.get('SHOP_URL')}/credits` : config.get('ACCOUNT_URL')}
                  onGetMore={method === 'credits' ? openBuyCredits : undefined}
                  selected={paymentMethod === method}
                  showCheckbox={methods.length > 1}
                  compactBuy={methods.length > 1}
                  disabled={isSubmitting}
                  onSelect={() => onPaymentMethodChange(method)}
                />
              ))}
            </Methods>
          )}
          {approveFailed && (
            <S.ErrorText data-testid="publish-approve-error">
              {t('publish_collection_modal.payment_step.approve_error')}
            </S.ErrorText>
          )}
        </S.PaymentMethods>

        <Checkbox checked={accepted} disabled={isSubmitting} onChange={onAcceptedChange} testId="publish-terms-accept">
          {intl.formatMessage(
            { id: 'publish_collection_modal.payment_step.checkbox' },
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
        <Button type="button" variant="secondary" disabled={isSubmitting} data-testid="publish-back" onClick={onBack}>
          <ChevronLeftIcon fontSize="small" />
          {t('publish_collection_modal.back')}
        </Button>
        <Button
          type="button"
          loading={isSubmitting}
          disabled={!canSubmit}
          data-testid="publish-submit"
          onClick={() => void handleSubmit()}
        >
          {t('publish_collection_modal.payment_step.submit')}
        </Button>
      </S.Footer>
      {isBuyingCredits && (
        <BuyCreditsModal
          balance={balances.credits}
          shortfall={creditsShortfall}
          onCancel={() => setBuyingCredits(false)}
          onBuy={buyCredits}
        />
      )}
    </S.Step>
  )
}

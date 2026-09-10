import { useMemo, useState, type FormEvent } from 'react'
import { CalendarTodayOutlined as CalendarIcon, InfoOutlined as InfoIcon } from '@mui/icons-material'
import { useIntl } from 'react-intl'
import { useTranslation } from '~/intl'
import { useFriends } from '~/hooks/useSales'
import { type Session } from '~/lib/auth'
import { type Item } from '~/lib/items'
import {
  NO_EXPIRATION,
  formatCreditsAsUsd,
  isValidAddress,
  minExpirationDate,
  parseExpirationDate,
  type SalePrice
} from '~/lib/sales'
import { Button } from '~/components/Button'
import { Checkbox } from '~/components/Checkbox'
import { CurrencyAmount } from '~/components/CurrencyAmount'
import { Modal } from '~/components/Modal'
import { InfoTooltip } from '~/components/Tooltip'
import { BeneficiaryInput } from './BeneficiaryInput'
import { SellItemCard } from './SellItemCard'
import { Switch } from './Switch'
import * as S from './SellItemModal.styles'

export type SellFormValues = {
  selfBeneficiary: boolean
  beneficiary: string
  credits: string
  free: boolean
  withExpiration: boolean
  /** `YYYY-MM-DD`, as the native date input reports it. */
  expirationDate: string
}

export const DEFAULT_SELL_VALUES: SellFormValues = {
  selfBeneficiary: true,
  beneficiary: '',
  credits: '',
  free: false,
  withExpiration: false,
  expirationDate: ''
}

export type SellSubmission = {
  price: SalePrice
  beneficiary: string
  expiresAt: number
}

type Props = {
  item: Item
  session: Session
  /** Restores a previous attempt's form after a failure. */
  initialValues?: SellFormValues
  /** A submit is in flight (custodial wallet, no prompt to wait for): the form dims and the button spins. */
  busy: boolean
  onSubmit: (values: SellFormValues, submission: SellSubmission) => void
  onClose: () => void
}

/** Resolves the form into what gets signed, or null while something is still missing or invalid. */
export function toSubmission(values: SellFormValues, address: string, now = Date.now()): SellSubmission | null {
  const beneficiary = values.selfBeneficiary ? address : values.beneficiary
  if (!values.free && !isValidAddress(beneficiary)) return null
  const credits = Number(values.credits)
  if (!values.free && (!Number.isInteger(credits) || credits < 1)) return null
  let expiresAt = NO_EXPIRATION
  if (values.withExpiration) {
    const parsed = parseExpirationDate(values.expirationDate)
    if (parsed === null || parsed <= now) return null
    expiresAt = parsed
  }
  return {
    price: values.free ? { kind: 'free' } : { kind: 'credits', credits },
    beneficiary: values.free ? address : beneficiary,
    expiresAt
  }
}

/** The Sell Item form: beneficiary, credits price (or giveaway), optional expiration date. */
export function SellItemModal({ item, session, initialValues = DEFAULT_SELL_VALUES, busy, onSubmit, onClose }: Props) {
  const { t } = useTranslation()
  const intl = useIntl()
  const [values, setValues] = useState<SellFormValues>(initialValues)
  const friends = useFriends(session, !values.selfBeneficiary)
  const minDate = useMemo(() => minExpirationDate(), [])

  const submission = useMemo(() => toSubmission(values, session.address), [values, session.address])
  const canSubmit = submission !== null && !busy

  const creditsNumber = Number(values.credits) || 0
  const expirationSet = values.withExpiration && values.expirationDate !== ''
  const expirationInvalid = useMemo(() => {
    if (!expirationSet) return false
    const parsed = parseExpirationDate(values.expirationDate)
    return parsed === null || parsed <= Date.now()
  }, [expirationSet, values.expirationDate])

  function update(patch: Partial<SellFormValues>) {
    setValues(current => ({ ...current, ...patch }))
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (submission && !busy) onSubmit(values, submission)
  }

  return (
    <Modal
      title={t('sell_item_modal.title')}
      size="wide"
      onClose={onClose}
      closeDisabled={busy}
      testId="sell-item-modal"
    >
      <S.Divider />
      <S.Form onSubmit={handleSubmit} data-testid="sell-item-form">
        <S.Fields data-busy={busy || undefined} aria-busy={busy || undefined} {...(busy ? { inert: '' } : {})}>
          <SellItemCard item={item} />
          <S.Subtitle>{t('sell_item_modal.subtitle')}</S.Subtitle>

          <S.Field>
            <S.Label>{t('sell_item_modal.beneficiary.label')}</S.Label>
            <Checkbox
              checked={values.selfBeneficiary}
              onChange={checked => update({ selfBeneficiary: checked })}
              disabled={busy}
              testId="sell-self-beneficiary"
            >
              {t('sell_item_modal.beneficiary.self')}
            </Checkbox>
            {!values.selfBeneficiary && (
              <BeneficiaryInput
                value={values.beneficiary}
                onChange={beneficiary => update({ beneficiary })}
                friends={friends.data}
                isLoadingFriends={friends.isLoading}
                disabled={busy}
                testId="sell-beneficiary"
              />
            )}
          </S.Field>

          <S.Field>
            <S.Label>{t('sell_item_modal.price.label')}</S.Label>
            <S.Box data-disabled={values.free || undefined}>
              <S.Glyph aria-hidden>
                <CurrencyAmount currency="credits">{null}</CurrencyAmount>
              </S.Glyph>
              <input
                type="text"
                inputMode="numeric"
                aria-label={t('sell_item_modal.price.label')}
                placeholder="0"
                value={values.free ? '0' : values.credits}
                disabled={values.free || busy}
                data-testid="sell-price"
                onChange={event => update({ credits: event.target.value.replace(/\D/g, '') })}
              />
              <S.Usd data-testid="sell-price-usd">{formatCreditsAsUsd(values.free ? 0 : creditsNumber)}</S.Usd>
            </S.Box>
            <S.Rate>{t('sell_item_modal.price.rate', { usd: formatCreditsAsUsd(1) })}</S.Rate>
            <Checkbox checked={values.free} onChange={free => update({ free })} disabled={busy} testId="sell-free">
              {t('sell_item_modal.price.giveaway')}
            </Checkbox>
          </S.Field>

          <S.Field>
            <S.Row>
              <S.Label id="sell-expiration-label">{t('sell_item_modal.expiration.label')}</S.Label>
              <Switch
                checked={values.withExpiration}
                onChange={withExpiration => update({ withExpiration })}
                disabled={busy}
                label={t('sell_item_modal.expiration.label')}
                testId="sell-expiration-toggle"
              />
            </S.Row>
            {values.withExpiration && (
              <>
                <S.Box data-invalid={expirationInvalid || undefined}>
                  <CalendarIcon aria-hidden />
                  <input
                    type="date"
                    aria-labelledby="sell-expiration-label"
                    min={minDate}
                    value={values.expirationDate}
                    disabled={busy}
                    data-testid="sell-expiration-date"
                    onChange={event => update({ expirationDate: event.target.value })}
                  />
                </S.Box>
                {expirationInvalid && (
                  <S.ErrorText data-testid="sell-expiration-error">
                    {t('sell_item_modal.expiration.invalid')}
                  </S.ErrorText>
                )}
              </>
            )}
          </S.Field>

          <S.Note data-testid="sell-note">
            <InfoIcon aria-hidden />
            <p>
              {intl.formatMessage(
                { id: 'sell_item_modal.note' },
                {
                  b: chunks => (
                    <b>
                      {chunks}
                      <InfoTooltip content={t('sell_item_modal.note_tooltip')} testId="sell-note-tooltip" />
                    </b>
                  )
                }
              )}
            </p>
          </S.Note>
        </S.Fields>

        <S.Footer>
          <Button type="button" variant="secondary" disabled={busy} data-testid="sell-cancel" onClick={onClose}>
            {t('sell_item_modal.cancel')}
          </Button>
          <Button type="submit" loading={busy} disabled={!canSubmit} data-testid="sell-submit">
            {t('sell_item_modal.submit')}
          </Button>
        </S.Footer>
      </S.Form>
    </Modal>
  )
}

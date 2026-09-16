import { useMemo, useState, type FormEvent } from 'react'
import {
  CalendarTodayOutlined as CalendarIcon,
  InfoOutlined as InfoIcon,
  WarningAmberOutlined as WarningIcon
} from '@mui/icons-material'
import DatePicker from 'react-datepicker'
import { useIntl } from 'react-intl'
import 'react-datepicker/dist/react-datepicker.css'
import { useTranslation } from '~/intl'
import { useFriends } from '~/hooks/useSales'
import { type Session } from '~/lib/auth'
import { type Item } from '~/lib/items'
import {
  MAX_SALE_CREDITS,
  NO_EXPIRATION,
  formatCreditsAsUsd,
  formatDateValue,
  isValidAddress,
  isValidCredits,
  minExpirationDate,
  parseExpirationDate,
  type SalePrice
} from '~/lib/sales'
import { formatCredits } from '~/lib/publishFee'
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
  /** Warns that buyers get the last approved version while edits await the committee. */
  hasPendingChanges?: boolean
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
  if (!values.free && !isValidCredits(credits)) return null
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
export function SellItemModal({
  item,
  session,
  initialValues = DEFAULT_SELL_VALUES,
  hasPendingChanges = false,
  busy,
  onSubmit,
  onClose
}: Props) {
  const { t } = useTranslation()
  const intl = useIntl()
  const [values, setValues] = useState<SellFormValues>(initialValues)
  const friends = useFriends(session, !values.selfBeneficiary)
  const minDate = useMemo(() => minExpirationDate(), [])

  const submission = useMemo(() => toSubmission(values, session.address), [values, session.address])
  const canSubmit = submission !== null && !busy

  const creditsNumber = Number(values.credits) || 0
  const priceTooHigh = !values.free && creditsNumber > Number(MAX_SALE_CREDITS)
  const expirationDate = useMemo(() => {
    const parsed = parseExpirationDate(values.expirationDate)
    return parsed === null ? null : new Date(parsed)
  }, [values.expirationDate])

  function update(patch: Partial<SellFormValues>) {
    setValues(current => ({ ...current, ...patch }))
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    // Re-derived at submit time: the memoized check may hold a stale `now` if the form sat open past midnight.
    const fresh = toSubmission(values, session.address)
    if (fresh) onSubmit(values, fresh)
  }

  return (
    <Modal
      title={t('sell_item_modal.title')}
      size="wide"
      compact
      onClose={onClose}
      closeDisabled={busy}
      testId="sell-item-modal"
    >
      <S.Divider />
      <S.Form onSubmit={handleSubmit} data-testid="sell-item-form">
        <S.Fields data-busy={busy || undefined} aria-busy={busy || undefined} {...(busy ? { inert: '' } : {})}>
          <SellItemCard item={item} />
          {hasPendingChanges && (
            <S.Note data-variant="warning" data-testid="sell-pending-changes">
              <WarningIcon aria-hidden />
              <p>{t('sell_item_modal.pending_changes')}</p>
            </S.Note>
          )}
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
            <S.Box data-disabled={values.free || undefined} data-invalid={priceTooHigh || undefined}>
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
            {priceTooHigh && (
              <S.ErrorText data-testid="sell-price-error">
                {t('sell_item_modal.price.too_high', { max: formatCredits(Number(MAX_SALE_CREDITS)) })}
              </S.ErrorText>
            )}
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
              <S.DateField>
                <CalendarIcon aria-hidden />
                <DatePicker
                  selected={expirationDate}
                  onChange={date => update({ expirationDate: date ? formatDateValue(date) : '' })}
                  minDate={minDate}
                  dateFormat="MM/dd/yyyy"
                  placeholderText="MM/DD/YYYY"
                  disabled={busy}
                  showPopperArrow={false}
                  popperProps={{ strategy: 'fixed' }}
                  popperPlacement="bottom-start"
                  ariaLabelledBy="sell-expiration-label"
                  customInput={<input data-testid="sell-expiration-date" />}
                />
              </S.DateField>
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

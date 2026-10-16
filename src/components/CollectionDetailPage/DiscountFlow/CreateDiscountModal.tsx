import { useMemo, useState, type FormEvent } from 'react'
import {
  CalendarTodayOutlined as CalendarIcon,
  InfoOutlined as InfoIcon,
  WarningAmberOutlined as WarningIcon
} from '@mui/icons-material'
import DatePicker from 'react-datepicker'
import { enUS, es, zhCN, type Locale as DateLocale } from 'date-fns/locale'
import { useIntl } from 'react-intl'
import 'react-datepicker/dist/react-datepicker.css'
import { useTranslation } from '~/intl'
import { type Locale } from '~/store/locale'
import {
  DiscountInputError,
  MAX_DISCOUNT_DURATION_MS,
  MAX_DISCOUNT_PCT,
  MIN_DISCOUNT_PCT,
  validateDiscountTerms
} from '~/lib/coupons'
import { discountedCredits, discountedManaWei, type DiscountReach } from '~/lib/collectionDiscount'
import { formatCredits, formatMana } from '~/lib/publishFee'
import { formatDateValue, minExpirationDate, parseExpirationDate } from '~/lib/sales'
import { Button } from '~/components/Button'
import { CurrencyAmount } from '~/components/CurrencyAmount'
import { Modal } from '~/components/Modal'
import { Switch } from '~/components/Switch'
import * as S from './DiscountFlow.styles'

const DATE_LOCALES: Record<Locale, DateLocale> = { en: enUS, es, zh: zhCN }
const PRESETS = [10, 20, 30, 50]
const ONE_DAY_MS = 24 * 60 * 60 * 1000
const DEFAULT_DAYS = 7

export type DiscountFormValues = {
  pct: string
  /** `YYYY-MM-DD`; the discount runs until the end of that local day. */
  endDate: string
  limited: boolean
  uses: string
}

export function defaultDiscountValues(now = Date.now()): DiscountFormValues {
  return { pct: '20', endDate: formatDateValue(new Date(now + DEFAULT_DAYS * ONE_DAY_MS)), limited: false, uses: '' }
}

export type DiscountSubmission = { discountPct: number; endsAtMs: number; uses?: number }

/** The form resolved into what gets signed, or null while something is missing or out of bounds. */
export function toDiscountSubmission(values: DiscountFormValues, now = Date.now()): DiscountSubmission | null {
  if (!/^\d+$/.test(values.pct)) return null
  const endsAtMs = parseExpirationDate(values.endDate)
  if (endsAtMs === null) return null
  if (values.limited && !/^\d+$/.test(values.uses)) return null
  const submission: DiscountSubmission = {
    discountPct: Number(values.pct),
    endsAtMs,
    ...(values.limited ? { uses: Number(values.uses) } : {})
  }
  try {
    // The collection is checked by the flow; here it only stands in so the rest of the terms are validated.
    validateDiscountTerms({ ...submission, collections: ['0x'] }, now)
    return submission
  } catch (error) {
    if (error instanceof DiscountInputError) return null
    throw error
  }
}

type Props = {
  collectionName: string
  reach: DiscountReach
  /** Whether MANA listings take the discount, which decides what the "unchanged" note says. */
  manaListings: boolean
  initialValues: DiscountFormValues
  /** A submit is in flight: the form dims and the button spins. */
  busy: boolean
  /** Ending a discount is a wallet transaction a social login can't send, so it runs until its date. */
  canEndEarly: boolean
  onSubmit: (values: DiscountFormValues, submission: DiscountSubmission) => void
  onClose: () => void
}

/** The Create Discount form: how much off, until when, and an optional cap on discounted purchases. */
export function CreateDiscountModal({
  collectionName,
  reach,
  manaListings,
  initialValues,
  busy,
  canEndEarly,
  onSubmit,
  onClose
}: Props) {
  const { t } = useTranslation()
  const intl = useIntl()
  const [values, setValues] = useState(initialValues)
  const minDate = useMemo(() => minExpirationDate(), [])
  // The last full day that still ends inside the longest window a discount may run.
  const maxDate = useMemo(() => new Date(Date.now() + MAX_DISCOUNT_DURATION_MS - ONE_DAY_MS), [])
  const submission = useMemo(() => toDiscountSubmission(values), [values])
  const endDate = useMemo(() => {
    const parsed = parseExpirationDate(values.endDate)
    return parsed === null ? null : new Date(parsed)
  }, [values.endDate])
  const nothingToDiscount = reach.discounted === 0
  const canSubmit = submission !== null && !nothingToDiscount && !busy
  const pct = submission?.discountPct ?? Number(values.pct)
  const pctInvalid =
    values.pct !== '' && (!/^\d+$/.test(values.pct) || pct < MIN_DISCOUNT_PCT || pct > MAX_DISCOUNT_PCT)

  function update(patch: Partial<DiscountFormValues>) {
    setValues(current => ({ ...current, ...patch }))
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (busy || nothingToDiscount) return
    // Re-derived at submit time: the memoized one may hold a stale `now` if the form sat open for a while.
    const fresh = toDiscountSubmission(values)
    if (fresh) onSubmit(values, fresh)
  }

  return (
    <Modal title={t('collection_discount.title')} onClose={onClose} closeDisabled={busy} testId="create-discount-modal">
      <S.Divider />
      <S.Form onSubmit={handleSubmit} data-testid="create-discount-form">
        <S.Fields data-busy={busy || undefined} aria-busy={busy || undefined} {...(busy ? { inert: '' } : {})}>
          <S.Subtitle>{t('collection_discount.subtitle', { name: collectionName })}</S.Subtitle>

          <S.Field>
            <S.Label id="discount-pct-label">{t('collection_discount.pct.label')}</S.Label>
            <S.Presets role="group" aria-labelledby="discount-pct-label">
              {PRESETS.map(preset => (
                <S.Preset
                  key={preset}
                  type="button"
                  data-selected={values.pct === String(preset) || undefined}
                  aria-pressed={values.pct === String(preset)}
                  data-testid={`discount-preset-${preset}`}
                  onClick={() => update({ pct: String(preset) })}
                >
                  {t('collection_discount.pct.value', { pct: preset })}
                </S.Preset>
              ))}
            </S.Presets>
            <S.InputBox data-invalid={pctInvalid || undefined}>
              <input
                inputMode="numeric"
                aria-labelledby="discount-pct-label"
                value={values.pct}
                onChange={event => update({ pct: event.target.value.replace(/\D/g, '').slice(0, 2) })}
                data-testid="discount-pct"
              />
              <S.Suffix aria-hidden>%</S.Suffix>
            </S.InputBox>
            {pctInvalid && (
              <S.ErrorText data-testid="discount-pct-error">
                {t('collection_discount.pct.range', { min: MIN_DISCOUNT_PCT, max: MAX_DISCOUNT_PCT })}
              </S.ErrorText>
            )}
          </S.Field>

          <S.Field>
            <S.Label id="discount-end-label">{t('collection_discount.ends.label')}</S.Label>
            <S.DateField>
              <CalendarIcon aria-hidden />
              <DatePicker
                selected={endDate}
                onChange={(date: Date | null) => update({ endDate: date ? formatDateValue(date) : '' })}
                minDate={minDate}
                maxDate={maxDate}
                locale={DATE_LOCALES[intl.locale as Locale] ?? enUS}
                dateFormat={t('sell_item_modal.expiration.date_format')}
                placeholderText={t('sell_item_modal.expiration.date_placeholder')}
                showPopperArrow={false}
                popperProps={{ strategy: 'fixed' }}
                popperPlacement="bottom-start"
                ariaLabelledBy="discount-end-label"
                customInput={<input data-testid="discount-end-date" />}
              />
            </S.DateField>
            <S.Label>{t('collection_discount.ends.hint', { days: MAX_DISCOUNT_DURATION_MS / ONE_DAY_MS })}</S.Label>
          </S.Field>

          <S.Field>
            <S.Row>
              <S.Label id="discount-limit-label">{t('collection_discount.limit.label')}</S.Label>
              <Switch
                checked={values.limited}
                onChange={limited => update({ limited })}
                label={t('collection_discount.limit.label')}
                testId="discount-limit-toggle"
              />
            </S.Row>
            {values.limited && (
              <S.InputBox>
                <input
                  inputMode="numeric"
                  aria-labelledby="discount-limit-label"
                  placeholder={t('collection_discount.limit.placeholder')}
                  value={values.uses}
                  onChange={event => update({ uses: event.target.value.replace(/\D/g, '').slice(0, 6) })}
                  data-testid="discount-limit"
                />
              </S.InputBox>
            )}
          </S.Field>

          {nothingToDiscount ? (
            <S.Note data-variant="warning" data-testid="discount-nothing">
              <WarningIcon aria-hidden />
              <p>{t(manaListings ? 'collection_discount.nothing' : 'collection_discount.nothing_mana_off')}</p>
            </S.Note>
          ) : (
            <S.Summary data-testid="discount-summary">
              <p>{t('collection_discount.summary.discounted', { count: reach.discounted, pct })}</p>
              {reach.example && values.pct !== '' && !pctInvalid && (
                <p data-testid="discount-example">
                  {'credits' in reach.example ? (
                    <>
                      <s>
                        <CurrencyAmount currency="credits">{formatCredits(reach.example.credits)}</CurrencyAmount>
                      </s>{' '}
                      <span aria-hidden>→</span>{' '}
                      <CurrencyAmount currency="credits">
                        {formatCredits(discountedCredits(reach.example.credits, pct))}
                      </CurrencyAmount>
                    </>
                  ) : (
                    <>
                      <s>
                        <CurrencyAmount currency="mana">{formatMana(reach.example.manaWei)}</CurrencyAmount>
                      </s>{' '}
                      <span aria-hidden>→</span>{' '}
                      <CurrencyAmount currency="mana">
                        {formatMana(discountedManaWei(reach.example.manaWei, pct))}
                      </CurrencyAmount>
                    </>
                  )}
                </p>
              )}
              {reach.unchanged > 0 && (
                <p data-muted data-testid="discount-unchanged">
                  {t(
                    manaListings
                      ? 'collection_discount.summary.unchanged'
                      : 'collection_discount.summary.unchanged_mana_off',
                    {
                      count: reach.unchanged
                    }
                  )}
                </p>
              )}
            </S.Summary>
          )}

          <S.Note>
            <InfoIcon aria-hidden />
            <p>{t(canEndEarly ? 'collection_discount.note' : 'collection_discount.note_social')}</p>
          </S.Note>
        </S.Fields>

        <S.Footer>
          <Button type="button" variant="secondary" disabled={busy} data-testid="discount-cancel" onClick={onClose}>
            {t('collection_discount.cancel')}
          </Button>
          <Button type="submit" loading={busy} disabled={!canSubmit} data-testid="discount-submit">
            {t('collection_discount.submit')}
          </Button>
        </S.Footer>
      </S.Form>
    </Modal>
  )
}

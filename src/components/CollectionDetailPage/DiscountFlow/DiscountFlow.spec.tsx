import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProviderType } from '@dcl/schemas'
import { type DiscountReach } from '~/lib/collectionDiscount'
import { DiscountError, type CollectionDiscount } from '~/lib/coupons'
import { Providers, collection, makeSession } from '../SellItemFlow/testUtils'
import { CollectionDiscounts } from './CollectionDiscounts'
import { toDiscountSubmission } from './CreateDiscountModal'
import { DiscountFlow } from './DiscountFlow'
import { EndDiscountFlow } from './EndDiscountFlow'

type Callbacks = { onSuccess?: () => void; onError?: (error: unknown) => void }
type Variables = { onSigned?: () => void; discountPct?: number; uses?: number; endsAtMs?: number }
const create = { mutate: vi.fn<(variables: Variables, callbacks: Callbacks) => void>(), isPending: false }
const end = { mutate: vi.fn<(variables: Variables, callbacks: Callbacks) => void>(), isPending: false }
vi.mock('~/hooks/useCollectionDiscounts', () => ({
  useCreateDiscount: () => create,
  useEndDiscount: () => end,
  useDiscountInFlight: () => ({ creating: create.isPending, ending: end.isPending }),
  endOutcome: () => undefined,
  lastCreatedDiscount: () => undefined
}))
vi.mock('~/lib/monitoring', () => ({ captureError: vi.fn() }))

const DAY = 24 * 60 * 60 * 1000
const lastCreate = () => create.mutate.mock.calls[create.mutate.mock.calls.length - 1]
const lastEnd = () => end.mutate.mock.calls[end.mutate.mock.calls.length - 1]

const reach: DiscountReach = { discounted: 3, unchanged: 1, example: { credits: 100 } }

function renderCreate(overrides: Partial<{ reach: DiscountReach; manaListings: boolean }> = {}) {
  const onClose = vi.fn()
  render(
    <DiscountFlow
      collection={collection}
      session={makeSession()}
      reach={overrides.reach ?? reach}
      manaListings={overrides.manaListings ?? false}
      onClose={onClose}
    />,
    { wrapper: Providers }
  )
  return { onClose }
}

beforeEach(() => {
  create.mutate.mockReset()
  end.mutate.mockReset()
})

describe('when resolving the discount form', () => {
  const now = new Date(2026, 9, 16, 12).getTime()
  const values = { pct: '30', endDate: '2026-10-23', limited: false, uses: '' }

  it('should run until the end of the chosen day, with no limit unless one is set', () => {
    expect(toDiscountSubmission(values, now)).toEqual({
      discountPct: 30,
      endsAtMs: new Date(2026, 9, 23, 23, 59, 59, 999).getTime()
    })
    expect(toDiscountSubmission({ ...values, limited: true, uses: '40' }, now)).toMatchObject({ uses: 40 })
  })

  it.each([
    ['a discount out of range', { pct: '80' }],
    ['no discount', { pct: '' }],
    ['an end more than 30 days away', { endDate: '2026-11-30' }],
    ['a limit switched on without a number', { limited: true, uses: '' }],
    ['a zero limit', { limited: true, uses: '0' }]
  ])('should hold back %s', (_, patch) => {
    expect(toDiscountSubmission({ ...values, ...patch }, now)).toBeNull()
  })
})

describe('when a creator creates a discount', () => {
  it('should say what it re-prices, sign it and celebrate', async () => {
    const { onClose } = renderCreate()
    expect(screen.getByTestId('discount-summary')).toHaveTextContent('3 items on sale will be 20% off')
    expect(screen.getByTestId('discount-unchanged')).toHaveTextContent('1 item keeps its price')

    await userEvent.click(screen.getByTestId('discount-preset-30'))
    expect(screen.getByTestId('discount-example')).toHaveTextContent('100 → 70')
    await userEvent.click(screen.getByTestId('discount-limit-toggle'))
    await userEvent.type(screen.getByTestId('discount-limit'), '25')
    await userEvent.click(screen.getByTestId('discount-submit'))

    expect(lastCreate()[0]).toMatchObject({ collection, discountPct: 30, uses: 25, discountedCount: 3 })
    expect(lastCreate()[0].endsAtMs).toBeGreaterThan(Date.now() + 6 * DAY)
    expect(screen.getByTestId('create-discount-pending-label')).toHaveTextContent(/confirm in your wallet/i)
    await act(async () => lastCreate()[0].onSigned?.())
    expect(screen.getByTestId('create-discount-pending-label')).toHaveTextContent(/creating your discount/i)

    await act(async () => lastCreate()[1].onSuccess?.())
    expect(screen.getByTestId('success-modal-title')).toHaveTextContent(/your discount is live/i)
    await userEvent.click(screen.getByTestId('success-modal-done'))
    expect(onClose).toHaveBeenCalled()
  })

  it('should not promise a social-login creator they can end it early', async () => {
    render(
      <DiscountFlow
        collection={collection}
        session={makeSession(ProviderType.MAGIC)}
        reach={reach}
        manaListings={false}
        onClose={vi.fn()}
      />,
      { wrapper: Providers }
    )
    expect(screen.getByTestId('create-discount-form')).toHaveTextContent(/can't end it early/i)
    await userEvent.click(screen.getByTestId('discount-submit'))
    await act(async () => lastCreate()[1].onSuccess?.())
    expect(screen.getByTestId('success-modal-description')).not.toHaveTextContent(/end it any time/i)
  })

  it('should explain why and not offer to sign when none of the listings can take it', () => {
    renderCreate({ reach: { discounted: 0, unchanged: 2, example: null } })
    expect(screen.getByTestId('discount-nothing')).toHaveTextContent(/priced in credits/i)
    expect(screen.getByTestId('discount-submit')).toBeDisabled()
  })

  it('should flag a discount out of range and not let it through', async () => {
    renderCreate()
    await userEvent.clear(screen.getByTestId('discount-pct'))
    await userEvent.type(screen.getByTestId('discount-pct'), '90')
    expect(screen.getByTestId('discount-pct-error')).toHaveTextContent('between 5% and 70%')
    expect(screen.getByTestId('discount-submit')).toBeDisabled()
  })

  it('should go back to the form, values kept, when the creator dismisses the wallet', async () => {
    renderCreate()
    await userEvent.click(screen.getByTestId('discount-preset-50'))
    await userEvent.click(screen.getByTestId('discount-submit'))
    await act(async () => lastCreate()[1].onError?.({ code: 4001, message: 'User rejected' }))
    expect(screen.getByTestId('discount-preset-50')).toHaveAttribute('data-selected')
  })

  it('should offer a retry when storing it fails', async () => {
    renderCreate()
    await userEvent.click(screen.getByTestId('discount-submit'))
    await act(async () => lastCreate()[1].onError?.(new Error('server down')))
    expect(screen.getByTestId('discount-error-modal-title')).toHaveTextContent(/couldn't create/i)
    await userEvent.click(screen.getByTestId('discount-error-retry'))
    expect(screen.getByTestId('create-discount-modal')).toBeInTheDocument()
  })
})

const running = {
  id: 'coupon-1',
  collections: ['0xcc'],
  discount: 300_000,
  checks: { effective: Date.now() - DAY, expiration: Date.now() + 3 * DAY, uses: 1_000_000 },
  status: 'active',
  state: null
} as unknown as CollectionDiscount

describe("when a creator looks at the collection's discounts", () => {
  it('should show each running or scheduled discount with a way to end it', async () => {
    const onEnd = vi.fn()
    const scheduled = {
      ...running,
      id: 'coupon-2',
      checks: { effective: Date.now() + DAY, expiration: Date.now() + 5 * DAY, uses: 40 },
      state: { uses: 0 }
    } as unknown as CollectionDiscount
    render(<CollectionDiscounts discounts={[running, scheduled]} now={Date.now()} onEnd={onEnd} />, {
      wrapper: Providers
    })

    const chips = screen.getAllByTestId('collection-discount')
    expect(chips[0]).toHaveTextContent('30% off')
    expect(chips[0]).toHaveTextContent(/Ends/)
    expect(chips[1]).toHaveAttribute('data-status', 'scheduled')
    expect(chips[1]).toHaveTextContent('0 of 40 used')
    expect(screen.queryByTestId('discount-other-collections')).not.toBeInTheDocument()
    await userEvent.click(screen.getAllByTestId('end-discount')[1])
    expect(onEnd).toHaveBeenCalledWith(scheduled)
  })
})

describe('when a creator ends a discount', () => {
  function renderEnd(discount = running, session = makeSession()) {
    const onClose = vi.fn()
    render(<EndDiscountFlow discount={discount} collection={collection} session={session} onClose={onClose} />, {
      wrapper: Providers
    })
    return { onClose }
  }

  it('should say ending a discount over several collections ends it on all of them', () => {
    renderEnd({ ...running, collections: ['0xcc', '0xdd', '0xee'] })
    expect(screen.getByTestId('end-discount-modal-description')).toHaveTextContent('2 other collections')
  })

  // A social login cannot move its wallet to Polygon or pay the gas.
  it('should tell a social-login creator the discount runs until its date, sending nothing', async () => {
    renderEnd(running, makeSession(ProviderType.MAGIC))
    expect(screen.getByTestId('end-discount-modal-description')).toHaveTextContent(/ends on its date/i)
    expect(screen.queryByTestId('end-discount-confirm')).not.toBeInTheDocument()
    expect(end.mutate).not.toHaveBeenCalled()
  })

  it('should warn it is a paid transaction, send it and celebrate', async () => {
    renderEnd()
    expect(screen.getByTestId('end-discount-modal-description')).toHaveTextContent(/30% discount.*POL/)
    await userEvent.click(screen.getByTestId('end-discount-confirm'))
    expect(lastEnd()[0]).toMatchObject({ discount: running, collection })
    await act(async () => lastEnd()[0].onSigned?.())
    expect(screen.getByTestId('end-discount-pending-label')).toHaveTextContent(/ending your discount/i)
    await act(async () => lastEnd()[1].onSuccess?.())
    expect(screen.getByTestId('success-modal-title')).toHaveTextContent(/discount ended/i)
  })

  it('should not offer a second paid cancellation while the first one is still mining', async () => {
    renderEnd()
    await userEvent.click(screen.getByTestId('end-discount-confirm'))
    await act(async () => lastEnd()[1].onError?.(new DiscountError('pending')))
    expect(screen.getByTestId('end-discount-slow-modal-description')).toHaveTextContent(/don't send it again/i)
    expect(screen.queryByTestId('end-discount-error-retry')).not.toBeInTheDocument()
  })

  it('should return to the confirmation on a dismissed wallet and offer a retry on a failure', async () => {
    renderEnd()
    await userEvent.click(screen.getByTestId('end-discount-confirm'))
    await act(async () => lastEnd()[1].onError?.({ code: 4001 }))
    expect(screen.getByTestId('end-discount-modal')).toBeInTheDocument()

    await userEvent.click(screen.getByTestId('end-discount-confirm'))
    await act(async () => lastEnd()[1].onError?.(new Error('insufficient funds')))
    expect(screen.getByTestId('end-discount-error-modal-description')).toHaveTextContent(/POL/)
    await userEvent.click(screen.getByTestId('end-discount-error-retry'))
    expect(screen.getByTestId('end-discount-modal')).toBeInTheDocument()
  })
})

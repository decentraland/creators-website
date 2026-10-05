import { beforeEach, describe, expect, it, vi } from 'vitest'
import { type ComponentProps } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TranslationProvider } from '~/intl'
import { type Session } from '~/lib/auth'
import { type Collection } from '~/lib/collections'
import { ItemType, type Item } from '~/lib/items'
import { ValidationSeverity, type ValidationIssue } from '~/lib/validation'
import { PublishCollectionModal } from './PublishCollectionModal'

const rerun = vi.fn()
vi.mock('~/hooks/useCollection', () => ({
  useAllCollectionItems: () => ({ data: [], isLoading: false }),
  useSaveCollection: () => ({ mutate: vi.fn(), isPending: false, error: null })
}))
vi.mock('~/hooks/useCollectionValidation', () => ({ useRerunItemValidation: () => rerun }))
vi.mock('~/lib/analytics', () => ({ track: vi.fn() }))
vi.mock('./ConfirmNameStep', () => ({ ConfirmNameStep: () => <div data-testid="confirm-name-step" /> }))
vi.mock('./ConfirmItemsStep', () => ({ ConfirmItemsStep: () => <div /> }))
vi.mock('./PaymentStep', () => ({ PaymentStep: () => <div data-testid="payment-step" /> }))
vi.mock('./TopUpOutcome', () => ({ TopUpOutcome: () => null }))

const collection = { id: 'c1', name: 'Halloween' } as Collection
const session = { address: '0xabc' } as Session

function makeItem(id: string): Item {
  return {
    id,
    name: `Item ${id}`,
    description: '',
    thumbnail: 'thumbnail.png',
    owner: '0xabc',
    isPublished: false,
    isApproved: false,
    inCatalyst: false,
    type: ItemType.WEARABLE,
    data: { category: 'hat', representations: [] },
    contents: {},
    createdAt: 1,
    updatedAt: 1
  }
}

const error: ValidationIssue = { code: 'skeleton', severity: ValidationSeverity.ERROR, message: 'Wrong skeleton' }
const warning: ValidationIssue = { code: 'textures', severity: ValidationSeverity.WARNING, message: 'Large texture' }
const broken = makeItem('broken')
const meh = makeItem('meh')
const clean = makeItem('clean')

type Props = ComponentProps<typeof PublishCollectionModal>
const onClose = vi.fn()

function renderModal(overrides: Partial<Props> = {}) {
  const props: Props = {
    collection,
    session,
    validation: { isValidating: true, results: [] },
    blockOnErrors: false,
    onClose,
    onPublished: vi.fn(),
    ...overrides
  }
  const view = render(<PublishCollectionModal {...props} />, { wrapper: TranslationProvider })
  return {
    ...view,
    update: (next: Partial<Props>) => view.rerender(<PublishCollectionModal {...props} {...next} />)
  }
}

beforeEach(() => {
  onClose.mockReset()
  rerun.mockReset().mockResolvedValue([])
})

describe('PublishCollectionModal item checks', () => {
  it('waits for the checks and goes straight to the first step when every item is clean', () => {
    const { update } = renderModal()
    expect(screen.getByTestId('publish-validating')).toBeInTheDocument()
    update({ validation: { isValidating: false, results: [{ item: clean, issues: [] }] } })
    expect(screen.getByTestId('confirm-name-step')).toBeInTheDocument()
  })

  it('closes from the waiting spinner', async () => {
    renderModal()
    await userEvent.click(screen.getByTestId('publish-validating-cancel'))
    expect(onClose).toHaveBeenCalled()
  })

  it('lists the flagged items, errors first, and offers no way past errors that block publishing', async () => {
    renderModal({
      blockOnErrors: true,
      validation: {
        isValidating: false,
        results: [
          { item: meh, issues: [warning] },
          { item: clean, issues: [] },
          { item: broken, issues: [error] }
        ]
      }
    })
    const cards = screen.getAllByTestId(/^publish-validation-.*-card$/)
    expect(cards.map(card => card.dataset.testid)).toEqual([
      'publish-validation-broken-card',
      'publish-validation-meh-card'
    ])
    expect(screen.getByTestId('publish-validation-issues-title')).toHaveTextContent('Some items need your attention')
    expect(screen.queryByTestId('publish-validation-continue')).not.toBeInTheDocument()
    await userEvent.click(screen.getByTestId('publish-validation-back'))
    expect(onClose).toHaveBeenCalled()
  })

  it('lets the creator continue past errors when they do not block publishing', async () => {
    renderModal({ validation: { isValidating: false, results: [{ item: broken, issues: [error] }] } })
    expect(screen.getByTestId('publish-validation-issues-title')).toHaveTextContent('Some items have issues')
    await userEvent.click(screen.getByTestId('publish-validation-continue'))
    expect(screen.getByTestId('confirm-name-step')).toBeInTheDocument()
  })

  it('never blocks on a check that could not run, even when errors block publishing', () => {
    const failed: ValidationIssue = { code: 'model', severity: ValidationSeverity.WARNING, message: 'Could not check' }
    renderModal({
      blockOnErrors: true,
      validation: { isValidating: false, results: [{ item: meh, issues: [failed] }] }
    })
    expect(screen.getByTestId('publish-validation-continue')).toBeInTheDocument()
  })

  it('lets the creator continue past warnings', async () => {
    renderModal({
      blockOnErrors: true,
      validation: { isValidating: false, results: [{ item: meh, issues: [warning] }] }
    })
    expect(screen.getByTestId('publish-validation-issues-title')).toHaveTextContent('A few things to review')
    await userEvent.click(screen.getByTestId('publish-validation-continue'))
    expect(screen.getByTestId('confirm-name-step')).toBeInTheDocument()
  })

  it('follows a re-run live: a fixed item stays listed as passing and the last error unlocks Continue', async () => {
    const { update } = renderModal({
      blockOnErrors: true,
      validation: {
        isValidating: false,
        results: [
          { item: broken, issues: [error] },
          { item: meh, issues: [warning] }
        ]
      }
    })
    await userEvent.click(screen.getByTestId('publish-validation-broken-rerun'))
    expect(rerun).toHaveBeenCalledWith(broken, 'publish', 'errors')

    update({
      blockOnErrors: true,
      validation: {
        isValidating: false,
        results: [
          { item: broken, issues: [] },
          { item: meh, issues: [warning] }
        ]
      }
    })
    expect(screen.getByTestId('publish-validation-broken-pass')).toBeInTheDocument()
    expect(screen.getByTestId('publish-validation-issues-title')).toHaveTextContent('A few things to review')
    expect(screen.getByTestId('publish-validation-continue')).toBeInTheDocument()
    expect(screen.queryByTestId('confirm-name-step')).not.toBeInTheDocument()
  })

  it('skips the checks when coming back from buying credits', () => {
    renderModal({ resume: { paymentMethod: 'credits', termsAccepted: true, orderId: null } })
    expect(screen.queryByTestId('publish-validating')).not.toBeInTheDocument()
    expect(screen.getByTestId('payment-step')).toBeInTheDocument()
  })
})

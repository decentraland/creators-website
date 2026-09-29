import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { TranslationProvider } from '~/intl'
import { BuilderServerError, ValidationLimitError } from '~/lib/builder'
import { type Collection } from '~/lib/collections'
import { type CollectionCuration } from '~/lib/curation'
import { type CollectionEvent } from '~/lib/events'
import { type Item } from '~/lib/items'
import { ReviewPanel } from './ReviewPanel'

const mocks = vi.hoisted(() => ({
  validate: vi.fn(),
  appeal: vi.fn(),
  toast: vi.fn()
}))
vi.mock('~/hooks/useCollectionEvents', () => ({
  useRequestValidation: () => ({ mutate: mocks.validate, isPending: false }),
  useAppealCuration: () => ({ mutate: mocks.appeal, isPending: false, isError: false, error: null })
}))
vi.mock('~/lib/notifications', () => ({
  useNotifications: (selector: (state: { showToast: typeof mocks.toast }) => unknown) =>
    selector({ showToast: mocks.toast })
}))

const collection = { id: 'c1', name: 'Hats', isPublished: true, isApproved: false } as Collection
const items = [{ id: 'i1', name: 'Pirate Hat', thumbnail: 'thumbnail.png', contents: {} } as Item]
const base: CollectionCuration = {
  id: 'r1',
  collectionId: 'c1',
  status: 'pending',
  assignee: null,
  reviewedBy: null,
  rejectionReasons: null,
  rejectionMessage: null,
  createdAt: 1,
  updatedAt: 1
}

let counter = 0
function event(type: string, payload: CollectionEvent['payload'] = {}, ageMs = 0): CollectionEvent {
  return {
    id: `e${++counter}`,
    collectionId: 'c1',
    type,
    actor: 'validator',
    actorAddress: null,
    payload,
    createdAt: Date.now() - ageMs
  }
}

const rejectedByValidator = { ...base, status: 'rejected' as const, reviewedBy: 'validator' }
const verdict = event('review.ai_rejected', {
  verdict: 'rejected',
  items: [
    {
      itemId: 'i1',
      contentHash: 'h',
      passed: false,
      findings: [
        { rule: 'M-01', severity: 'error', message: 'Too many triangles', measured: 1940, limit: 1500, fix: 'Decimate' }
      ]
    }
  ]
})

function renderPanel(curation: CollectionCuration | null, events: CollectionEvent[] | null, canManage = true) {
  render(
    <TranslationProvider>
      <ReviewPanel
        collection={collection}
        address="0xme"
        curation={curation}
        events={events}
        items={items}
        canManage={canManage}
      />
    </TranslationProvider>
  )
}

beforeEach(() => {
  mocks.validate.mockReset()
  mocks.appeal.mockReset()
  mocks.toast.mockReset()
})

describe('ReviewPanel', () => {
  it('tells the creator the AI is reviewing, never that it is delayed', () => {
    renderPanel(base, [event('review.ai_error')])
    expect(screen.getByTestId('review-notice')).toHaveAttribute('data-stage', 'ai_reviewing')
    expect(screen.queryByTestId('review-panel')).toBeNull()
  })

  it('falls back to the legacy notice without a timeline', () => {
    renderPanel({ ...base, assignee: '0xcurator' }, null)
    expect(screen.getByTestId('review-notice')).toHaveTextContent('A curator is reviewing your collection.')
  })

  it('offers no retry or appeal for a curator rejection without a timeline (auto-curation off)', () => {
    renderPanel({ ...base, status: 'rejected', reviewedBy: '0xcurator', rejectionMessage: 'Fix it' }, null)
    expect(screen.queryByTestId('review-panel')).toBeNull()
    expect(screen.getByTestId('review-notice')).toHaveAttribute('data-stage', 'rejected')
  })

  it("lists the validator's findings per item and validates again", () => {
    renderPanel(rejectedByValidator, [verdict])
    expect(screen.getByTestId('review-panel')).toHaveAttribute('data-stage', 'rejected_by_validator')
    const finding = screen.getByTestId('review-panel-findings-i1-finding')
    expect(finding).toHaveTextContent('M-01')
    expect(finding).toHaveTextContent('Measured: 1940')
    expect(finding).toHaveTextContent('Limit: 1500')
    expect(finding).toHaveTextContent('Decimate')
    expect(screen.getByTestId('review-panel-findings-item')).toHaveTextContent('Pirate Hat')
    expect(screen.getByTestId('validation-attempts')).toHaveTextContent('2 of 3 left today')
    fireEvent.click(screen.getByTestId('validate-again'))
    expect(mocks.validate).toHaveBeenCalledWith({ collection, events: [verdict] }, expect.anything())
  })

  it("shows the curator's reasons and message", () => {
    renderPanel(
      {
        ...base,
        status: 'rejected',
        reviewedBy: '0xcurator',
        rejectionReasons: ['clipping', 'thumbnail'],
        rejectionMessage: 'The hat clips through the hair.'
      },
      [event('review.rejected')]
    )
    expect(screen.getByTestId('review-panel')).toHaveAttribute('data-stage', 'rejected_by_curator')
    expect(screen.getByTestId('review-panel-reasons')).toHaveTextContent('Clipping')
    expect(screen.getByTestId('review-panel-reasons')).toHaveTextContent('Thumbnail')
    expect(screen.getByTestId('review-panel-message')).toHaveTextContent('The hat clips through the hair.')
  })

  it('stops the retry once the three daily attempts are spent', () => {
    const spent = [
      verdict,
      event('review.ai_rejected', { verdict: 'rejected', items: [] }, 1000),
      event('review.ai_rejected', { verdict: 'rejected', items: [] }, 2000)
    ]
    renderPanel(rejectedByValidator, spent)
    expect(screen.getByTestId('validation-attempts')).toHaveTextContent('No automatic reviews left today')
    fireEvent.click(screen.getByTestId('validate-again'))
    expect(mocks.validate).not.toHaveBeenCalled()
  })

  it('explains a 429 and a 409 from the server', () => {
    renderPanel(rejectedByValidator, [verdict])
    mocks.validate.mockImplementationOnce((_vars, { onError }) =>
      onError(
        new ValidationLimitError(
          new BuilderServerError('limit', 429, { retryAt: new Date(Date.now() + 3 * 3_600_000).toISOString() })
        )
      )
    )
    fireEvent.click(screen.getByTestId('validate-again'))
    expect(mocks.toast).toHaveBeenLastCalledWith(expect.stringContaining('in 3 hours'), { type: 'warn' })
    mocks.validate.mockImplementationOnce((_vars, { onError }) => onError(new BuilderServerError('running', 409)))
    fireEvent.click(screen.getByTestId('validate-again'))
    expect(mocks.toast).toHaveBeenLastCalledWith('An automatic review is already running.', { type: 'warn' })
  })

  it('requests a human review with a required note', () => {
    renderPanel(rejectedByValidator, [verdict])
    fireEvent.click(screen.getByTestId('request-human-review'))
    const submit = screen.getByTestId('appeal-submit')
    expect(submit).toBeDisabled()
    fireEvent.change(screen.getByTestId('appeal-note'), { target: { value: 'I reduced the triangles.' } })
    fireEvent.click(submit)
    expect(mocks.appeal).toHaveBeenCalledWith({ collection, note: 'I reduced the triangles.' }, expect.anything())
  })

  it('offers no actions to viewers without rights', () => {
    renderPanel(rejectedByValidator, [verdict], false)
    expect(screen.queryByTestId('validate-again')).toBeNull()
    expect(screen.queryByTestId('request-human-review')).toBeNull()
  })
})

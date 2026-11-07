import { afterEach, describe, expect, it } from 'vitest'
import { collection, publishedItem } from './fixtures'
import { launchApp, type App } from './helpers/app'
import { clickTestId, isShown, waitForTestId } from './helpers/dom'
import { TEST_ADDRESS } from './helpers/session'

let app: App | undefined
afterEach(async () => {
  await app?.close()
  app = undefined
})

const CREATOR = '0x' + '22'.repeat(20)
const NOW = new Date().toISOString()
// On chain, never reviewed and without a review request yet: what the committee sees as new and to review.
const submitted = collection({
  name: 'Neon Streetwear',
  eth_address: CREATOR,
  contract_address: '0x' + 'c0'.repeat(20),
  is_published: true,
  created_at: NOW,
  reviewed_at: NOW,
  updated_at: NOW
})
// The stored files are the ones on chain, so the approval needs no rescue.
const items = [0, 1].map(index =>
  publishedItem(submitted, index, {
    is_approved: false,
    in_catalyst: false,
    content_hash: `bafyitem${index}`,
    local_content_hash: `bafyitem${index}`
  })
)
const builder = { collections: [submitted], items, committee: [TEST_ADDRESS] }
const reviewPath = `/collections/editor?collection=${submitted.id}&reviewing=true`

const curationState = (a: App) =>
  a.page.$eval('[data-testid="review-bar"] [data-testid="curation-state"]', el => el.getAttribute('data-state'))

describe('curation', () => {
  it('lists a submission, assigns it and approves it from the editor', async () => {
    app = await launchApp({ path: '/curation', builder })
    const { page } = app
    await waitForTestId(page, 'nav-curation')
    await waitForTestId(page, 'curation-row')

    await clickTestId(page, 'curation-row-assign-me')
    await waitForTestId(page, 'assign-curator-modal')
    await clickTestId(page, 'assign-curator-submit')
    await waitForTestId(page, 'curation-row-curator')
    expect(app.builder.curations.get(submitted.id)).toMatchObject({ status: 'pending', assignee: TEST_ADDRESS })
    await app.waitForEvent('Assign curator', { collectionId: submitted.id })

    await clickTestId(page, 'curation-row-link')
    await waitForTestId(page, 'review-bar', 30_000)
    await clickTestId(page, 'review-action-approve')
    await waitForTestId(page, 'approval-steps', 30_000)

    // Items go to the Catalyst first, then the committee approves the collection on chain.
    await clickTestId(page, 'approval-deploy')
    await waitForTestId(page, 'approval-approve', 60_000)
    expect(app.writes.filter(write => write === 'POST /content/entities')).toHaveLength(items.length)
    await clickTestId(page, 'approval-approve')
    await waitForTestId(page, 'success-modal-modal', 60_000)

    const approval = app.transactions.find(tx => tx.fn === 'manageCollection')
    expect(String(approval?.args?.collection).toLowerCase()).toBe(submitted.contract_address)
    expect(app.builder.collections.get(submitted.id)?.is_approved).toBe(true)
    expect(app.builder.curations.get(submitted.id)?.status).toBe('approved')
    await app.waitForEvent('Approve collection', { collectionId: submitted.id })
    await clickTestId(page, 'success-modal-done')
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-testid="review-bar"] [data-testid="curation-state"]')
          ?.getAttribute('data-state') === 'approved'
    )
  })

  it('rejects a submission, taking it over first', async () => {
    app = await launchApp({ path: reviewPath, builder })
    const { page } = app
    await waitForTestId(page, 'review-bar', 30_000)

    await clickTestId(page, 'review-action-reject')
    // Nobody is assigned yet, so the curator takes the review before deciding.
    await waitForTestId(page, 'assign-curator-modal')
    await clickTestId(page, 'assign-curator-submit')
    await waitForTestId(page, 'review-reject-confirm')
    await clickTestId(page, 'review-reject-confirm')

    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-testid="review-bar"] [data-testid="curation-state"]')
          ?.getAttribute('data-state') === 'rejected',
      { timeout: 15_000 }
    )
    expect(app.builder.curations.get(submitted.id)).toMatchObject({ status: 'rejected', assignee: TEST_ADDRESS })
    expect(await curationState(app)).toBe('rejected')
    await app.waitForEvent('Reject curation', { collectionId: submitted.id })
  })

  it('is not there for anyone off the committee', async () => {
    app = await launchApp({ path: '/curation', builder: { ...builder, committee: [] } })
    await waitForTestId(app.page, 'not-found-page')
    expect(await isShown(app.page, 'nav-curation')).toBe(false)
  })
})

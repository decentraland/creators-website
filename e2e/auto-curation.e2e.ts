import { afterEach, describe, expect, it } from 'vitest'
import { publishedCollection, publishedItem } from './fixtures'
import { launchApp, type App } from './helpers/app'
import { type RemoteCollectionEventRow, type RemoteCurationRow } from './helpers/builderServer'
import { clickTestId, isShown, waitForTestId } from './helpers/dom'
import { TEST_ADDRESS } from './helpers/session'

let app: App | undefined
afterEach(async () => {
  await app?.close()
  app = undefined
})

const FLAGS = { 'builder-auto-curation': true }
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()

const collection = publishedCollection({
  name: 'Neon Streetwear',
  is_approved: false,
  created_at: minutesAgo(30),
  reviewed_at: minutesAgo(30),
  updated_at: minutesAgo(30)
})
const hat = publishedItem(collection, 0, { is_approved: false, local_content_hash: 'bafyhat' })

const event = (
  type: string,
  createdAt: string,
  payload: Record<string, unknown> = {},
  actor: RemoteCollectionEventRow['actor'] = 'validator'
): RemoteCollectionEventRow => ({
  id: `${type}-${createdAt}`,
  collection_id: collection.id,
  type,
  actor,
  actor_address: null,
  payload,
  created_at: createdAt
})

const start = event('review.automated_started', minutesAgo(20), {
  validationId: 'v1',
  trigger: 'publish',
  itemIds: [hat.id]
})
const rejection = event('review.automated_rejected', minutesAgo(15), {
  validationId: 'v1',
  verdict: 'rejected',
  rulesVersion: '0.7.0',
  items: [
    {
      itemId: hat.id,
      contentHash: 'bafyhat',
      passed: false,
      findings: [
        { rule: 'M-01', check: 'triangle-count', severity: 'error', message: 'The hat has too many triangles.' }
      ]
    }
  ]
})

const curation = (overrides: Partial<RemoteCurationRow>): RemoteCurationRow => ({
  id: `curation-${collection.id}`,
  collection_id: collection.id,
  status: 'pending',
  assignee: null,
  created_at: minutesAgo(20),
  updated_at: minutesAgo(15),
  ...overrides
})
const rejectedByValidator = curation({ status: 'rejected', reviewed_by: 'validator' })

describe('automated review', () => {
  it("shows the validator's findings once and sends the collection to a curator on request", async () => {
    const builder = {
      collections: [collection],
      items: [hat],
      curations: [rejectedByValidator],
      events: [start, rejection]
    }
    app = await launchApp({ path: `/collections/${collection.id}`, builder, flags: FLAGS })
    const { page } = app

    await waitForTestId(page, 'automated-issues-modal', 30_000)
    await waitForTestId(page, `automated-issues-${hat.id}-card`)
    await clickTestId(page, 'automated-issues-back')
    await page.waitForFunction(() => !document.querySelector('[data-testid="automated-issues-modal"]'))

    // Seen once: while the rejection still stands, a reload shows the page, not the same verdict again.
    await page.reload({ waitUntil: 'networkidle2' })
    await waitForTestId(page, 'review-notice', 30_000)
    expect(await isShown(page, 'automated-issues-modal')).toBe(false)

    const chip = await waitForTestId(page, 'item-row-validation')
    expect(await chip.evaluate(el => el.getAttribute('data-status'))).toBe('errors')
    expect(await isShown(page, 'item-row-edit-name')).toBe(true)

    await clickTestId(page, 'request-curator-review')
    await waitForTestId(page, 'request-review-modal')
    await clickTestId(page, 'request-review-confirm')
    await waitForTestId(page, 'sent-for-review-modal-modal')
    expect(app.builder.curations.get(collection.id)?.status).toBe('pending')
    expect(app.builder.events.map(row => row.type)).toContain('review.appeal_requested')
    await app.waitForEvent('Appeal curation', { collectionId: collection.id })
  })

  it('pauses item editing while the automated review runs', async () => {
    const builder = {
      collections: [collection],
      items: [hat],
      curations: [curation({ updated_at: minutesAgo(1) })],
      events: [
        event('review.automated_started', minutesAgo(1), { validationId: 'v2', trigger: 'publish', itemIds: [hat.id] })
      ]
    }
    app = await launchApp({ path: `/collections/${collection.id}`, builder, flags: FLAGS })
    const { page } = app

    const notice = await waitForTestId(page, 'review-notice', 30_000)
    expect(await notice.evaluate(el => el.getAttribute('data-stage'))).toBe('automated_reviewing')
    await waitForTestId(page, 'item-row')
    expect(await isShown(page, 'item-row-edit-name')).toBe(false)
    expect(await isShown(page, 'item-row-edit-thumbnail')).toBe(false)
  })

  it("lets a curator read the validator's verdict on an appeal and reject with reasons", async () => {
    const appeal = event('review.appeal_requested', minutesAgo(5), { note: '' }, 'creator')
    const builder = {
      collections: [{ ...collection, eth_address: '0x' + '22'.repeat(20) }],
      items: [hat],
      curations: [curation({ created_at: minutesAgo(5), updated_at: minutesAgo(5) })],
      events: [start, rejection, appeal],
      committee: [TEST_ADDRESS]
    }
    app = await launchApp({
      path: `/collections/editor?collection=${collection.id}&reviewing=true`,
      builder,
      flags: FLAGS
    })
    const { page } = app

    await waitForTestId(page, 'review-bar', 30_000)
    await clickTestId(page, 'review-automated-verdict')
    const headline = await waitForTestId(page, 'automated-verdict-headline')
    expect(await headline.evaluate(el => el.getAttribute('data-passed'))).toBe('false')
    await clickTestId(page, 'automated-verdict-modal-close')

    await page.waitForFunction(
      () => !document.querySelector<HTMLButtonElement>('[data-testid="review-action-reject"]')?.disabled
    )
    await clickTestId(page, 'review-action-reject')
    // A curator who doesn't hold the review takes it over before deciding.
    await waitForTestId(page, 'assign-curator-modal')
    await clickTestId(page, 'assign-curator-submit')
    await page.waitForFunction(() => !document.querySelector('[data-testid="assign-curator-modal"]'))
    expect(app.builder.curations.get(collection.id)?.assignee).toBe(TEST_ADDRESS)
    await waitForTestId(page, 'reject-curation-modal')
    await waitForTestId(page, 'reject-reasons')
  })
})

import { ethers } from 'ethers'
import { afterEach, describe, expect, it } from 'vitest'
import { collection, upperBody, wearable } from './fixtures'
import { launchApp, type App } from './helpers/app'
import { byTestId, check, clickTestId, waitForEnabled, waitForTestId } from './helpers/dom'

let app: App | undefined
afterEach(async () => {
  await app?.close()
  app = undefined
})

// A draft that was saved once: the server has derived its salt and contract address.
const draft = collection({
  name: 'Summer Drop',
  salt: ethers.utils.id('summer-drop'),
  contract_address: '0x' + 'c0'.repeat(20)
})
const items = [
  wearable({ collection_id: draft.id, name: 'Red Bandana', rarity: 'epic' }),
  upperBody({ collection_id: draft.id, rarity: 'epic' })
]

const statusOf = (a: App) => a.page.$eval(byTestId('collection-status'), el => el.getAttribute('data-status'))

describe('publish a collection', () => {
  it('pays the fee in MANA, publishes on chain and opens the first review', async () => {
    app = await launchApp({
      path: `/collections/${draft.id}`,
      builder: { collections: [draft], items },
      chain: { manaBalanceWei: ethers.utils.parseEther('100').toString() }
    })
    const { page } = app
    await waitForEnabled(page, 'publish-collection', 30_000)
    await clickTestId(page, 'publish-collection')

    await waitForTestId(page, 'publish-name-step', 30_000)
    await page.waitForSelector(byTestId('publish-name-loading'), { hidden: true })
    await page.type(byTestId('publish-email-input'), 'jane.doe@example.com')
    await check(page, 'publish-name-accept')
    await clickTestId(page, 'publish-name-confirm')

    await waitForTestId(page, 'publish-items-step')
    expect(await page.$$eval(byTestId('publish-item-row'), rows => rows.length)).toBe(2)
    await check(page, 'publish-items-accept')
    await clickTestId(page, 'publish-items-confirm')

    await waitForTestId(page, 'publish-payment-step')
    await page.waitForSelector('[data-testid="payment-method-mana"][data-selected]')
    await check(page, 'publish-terms-accept')
    await waitForEnabled(page, 'publish-submit')
    await clickTestId(page, 'publish-submit')

    await waitForTestId(page, 'publish-success-modal', 30_000)
    await app.waitForEvent('Publish collection', { collectionId: draft.id, usedCredits: false, item_count: 2 })
    const publish = app.transactions.find(tx => tx.fn === 'createCollection')
    // The salt the server derived on the save right before publishing.
    expect(publish?.args?.salt).toBe(app.builder.collections.get(draft.id)?.salt)
    expect(publish?.args?.name).toBe('Summer Drop')
    expect(publish?.args?.items).toHaveLength(2)
    expect(app.writes).toContain(`POST /v1/collections/${draft.id}/tos`)

    // Once mined, the server learns about the publication and the first review request opens.
    await clickTestId(page, 'publish-success-done')
    await page.waitForSelector('[data-testid="collection-status"][data-status="under_review"]', { timeout: 30_000 })
    const published = app.builder.collections.get(draft.id)!
    expect(published).toMatchObject({ is_published: true, lock: expect.any(String) as string })
    expect(published.forum_link).toBeTruthy()
    expect(app.builder.curations.get(draft.id)?.status).toBe('pending')
    expect(await statusOf(app)).toBe('under_review')
  })

  it('is blocked by an invalid item while the validation gate is on', async () => {
    app = await launchApp({
      path: `/collections/${draft.id}`,
      builder: { collections: [draft], items: [items[0], upperBody({ collection_id: draft.id }, { invalid: true })] },
      flags: { 'builder-block-publish-on-validation-errors': true }
    })
    await app.page.waitForSelector('[data-testid="publish-collection"][data-blocker="has_invalid_items"]', {
      timeout: 30_000
    })
    await clickTestId(app.page, 'publish-collection')
    expect(await app.page.$(byTestId('publish-name-step'))).toBeNull()
  })
})

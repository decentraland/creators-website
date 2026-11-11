import { type ElementHandle } from 'puppeteer'
import { afterEach, describe, expect, it } from 'vitest'
import { collection, upperBody, wearable } from './fixtures'
import { launchApp, type App } from './helpers/app'
import { FIXTURE } from './helpers/files'
import { byTestId, clickTestId, selectOption, waitForEditor, waitForTestId, waitForToast } from './helpers/dom'

let app: App | undefined
afterEach(async () => {
  await app?.close()
  app = undefined
})

const draft = collection({ name: 'Summer Drop' })
const hat = wearable({ collection_id: draft.id, name: 'Red Bandana' })
const polo = upperBody({ collection_id: draft.id }, { invalid: true })

const editorPath = (itemId: string) => `/collections/editor?collection=${draft.id}&item=${itemId}`

async function openEditor(itemId: string): Promise<App> {
  const launched = await launchApp({ path: editorPath(itemId), builder: { collections: [draft], items: [hat, polo] } })
  await waitForEditor(launched.page)
  return launched
}

const badgeStatus = (a: App, status: string) =>
  a.page.waitForSelector(`[data-testid="validation-badge"][data-status="${status}"]`, { timeout: 30_000 })

describe('item editor', () => {
  it('saves name, category and hides, and keeps them after a reload', async () => {
    app = await openEditor(hat.id)
    const { page } = app
    await badgeStatus(app, 'pass')

    await page.click(byTestId('properties-panel-name'), { count: 3 })
    await page.keyboard.type('Bandana Deluxe')
    await selectOption(page, 'properties-panel-category', 'helmet')
    await clickTestId(page, 'properties-panel-hides-categories')
    await clickTestId(page, 'properties-panel-hides-categories-option-eyewear')
    await page.keyboard.press('Escape')
    await clickTestId(page, 'properties-panel-save')

    await waitForToast(page)
    await app.waitForEvent('Save item', { itemId: hat.id })
    const saved = app.builder.items.get(hat.id)!
    expect(saved).toMatchObject({ name: 'Bandana Deluxe', data: { category: 'helmet' } })
    expect(saved.data.hides).toContain('eyewear')
    // The item's hides apply to every body shape's model.
    for (const representation of saved.data.representations as Array<{ overrideHides: string[] }>) {
      expect(representation.overrideHides).toContain('eyewear')
    }

    await page.reload({ waitUntil: 'networkidle2' })
    await waitForEditor(page)
    expect(await page.$eval(byTestId('properties-panel-name'), el => (el as HTMLInputElement).value)).toBe(
      'Bandana Deluxe'
    )
    expect(app.pageViews()).toEqual(['item_editor', 'item_editor'])
  })

  it('saves a new thumbnail as soon as it is confirmed, leaving unsaved details pending', async () => {
    app = await openEditor(hat.id)
    const { page } = app
    const before = app.builder.items.get(hat.id)!.contents['thumbnail.png']

    await page.click(byTestId('properties-panel-name'), { count: 3 })
    await page.keyboard.type('Unsaved Name')
    await clickTestId(page, 'properties-panel-thumbnail')
    await waitForTestId(page, 'thumbnail-modal')
    const input = (await page.$(byTestId('thumbnail-file-input'))) as ElementHandle<HTMLInputElement>
    await input.uploadFile(FIXTURE.thumbnail)

    await app.waitForEvent('Save item', { itemId: hat.id })
    const saved = app.builder.items.get(hat.id)!
    expect(saved.contents['thumbnail.png']).not.toBe(before)
    expect(saved.name).toBe(hat.name)
    expect(await page.$eval(byTestId('properties-panel-name'), el => (el as HTMLInputElement).value)).toBe(
      'Unsaved Name'
    )
  })

  it('shows the rule book errors of an invalid model', async () => {
    app = await openEditor(polo.id)
    await badgeStatus(app, 'errors')

    await clickTestId(app.page, 'validation-badge')
    await waitForTestId(app.page, 'validation-badge-modal')
    await app.page.waitForSelector(
      '[data-testid="validation-badge-modal"] [data-severity="error"][data-code="texture-size"]'
    )
    await app.waitForEvent('Item Validation Details Opened', { itemId: polo.id, status: 'errors', trigger: 'editor' })
  })
})

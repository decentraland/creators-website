import { readFileSync } from 'node:fs'
import { type ElementHandle } from 'puppeteer'
import { afterEach, describe, expect, it } from 'vitest'
import { collection, emote as silentEmote } from './fixtures'
import { launchApp, type App } from './helpers/app'
import { byTestId, clickTestId, selectOption, waitForEditor, waitForEnabled, waitForTestId } from './helpers/dom'
import { FIXTURE, emoteWithAudioZip } from './helpers/files'

let app: App | undefined
afterEach(async () => {
  await app?.close()
  app = undefined
})

const draft = collection({ name: 'Summer Drop' })

describe('emote audio', () => {
  it('imports an emote with its sound, and the editor offers to mute it', async () => {
    app = await launchApp({ path: `/collections/${draft.id}`, builder: { collections: [draft] } })
    const { page } = app
    await waitForTestId(page, 'collection-empty')
    const input = (await page.$(byTestId('add-items-input'))) as ElementHandle<HTMLInputElement>
    await input.uploadFile(await emoteWithAudioZip())

    await waitForTestId(page, 'draft-form', 30_000)
    await selectOption(page, 'item-category', 'fun')
    await waitForEnabled(page, 'add-items-finish')
    await clickTestId(page, 'add-items-finish')
    await page.waitForFunction(() => !document.querySelector('[data-testid="add-items-modal"]'), { timeout: 30_000 })

    const [emote] = [...app.builder.items.values()]
    expect(emote.type).toBe('emote')
    const sounds = Object.keys(emote.contents).filter(path => path.endsWith('.mp3'))
    // Every body shape plays the same sound, uploaded byte for byte.
    expect(sounds.length).toBeGreaterThan(0)
    const audio = readFileSync(FIXTURE.emoteWithPropsAudio)
    for (const path of sounds) expect(app.storage[emote.contents[path]]?.equals(audio)).toBe(true)

    await page.goto(new URL(`/collections/editor?collection=${draft.id}&item=${emote.id}`, page.url()).href)
    await waitForEditor(page)
    await waitForTestId(page, 'playback-bar-sound', 30_000)
    await clickTestId(page, 'playback-bar-sound')
    await page.waitForSelector('[data-testid="playback-bar-sound"][data-muted]')
  })

  it('offers no mute control for a silent emote', async () => {
    const wave = silentEmote({ collection_id: draft.id })
    app = await launchApp({
      path: `/collections/editor?collection=${draft.id}&item=${wave.id}`,
      builder: { collections: [draft], items: [wave] }
    })
    await waitForEditor(app.page)
    await waitForTestId(app.page, 'playback-bar-emote-controls', 30_000)
    // The sound check answers asynchronously, so give it time to show up before calling it absent.
    await expect(app.page.waitForSelector(byTestId('playback-bar-sound'), { timeout: 3_000 })).rejects.toThrow()
  })
})

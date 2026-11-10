import { afterEach, describe, expect, it } from 'vitest'
import { collection } from './fixtures'
import { launchApp, type App } from './helpers/app'
import { clickTestId, isShown, waitForTestId } from './helpers/dom'
import { TEST_ADDRESS } from './helpers/session'

let app: App | undefined
afterEach(async () => {
  await app?.close()
  app = undefined
})

const builder = { collections: [collection({ name: 'Summer Drop' })] }
const PRELAUNCH = 'builder-creators-prelaunch'

describe('pre-launch gate', () => {
  it('sends a wallet off the allowlist back to the overview', async () => {
    app = await launchApp({
      path: '/collections?utm_source=e2e',
      builder,
      flags: { [PRELAUNCH]: true },
      variants: { [PRELAUNCH]: '0x' + '22'.repeat(20) }
    })
    await waitForTestId(app.page, 'overview-page')
    const url = new URL(app.page.url())
    expect(url.pathname).toBe('/')
    // Campaign parameters survive the redirect, so the overview's page view keeps them.
    expect(url.searchParams.get('utm_source')).toBe('e2e')
    expect(await isShown(app.page, 'subnav')).toBe(false)
    await app.waitForEvent('Prelaunch gate', { outcome: 'hidden' })
  })

  it('opens the app to an allowlisted wallet', async () => {
    app = await launchApp({
      path: '/collections',
      builder,
      flags: { [PRELAUNCH]: true },
      variants: { [PRELAUNCH]: `0x${'22'.repeat(20)}, ${TEST_ADDRESS}` }
    })
    await waitForTestId(app.page, 'collections-grid')
    expect(await isShown(app.page, 'subnav')).toBe(true)
    await app.waitForEvent('Prelaunch gate', { outcome: 'open' })
  })
})

describe('maintenance', () => {
  it('replaces every page with the maintenance notice', async () => {
    app = await launchApp({ path: '/collections', builder, flags: { 'builder-maintenance': true } })
    await waitForTestId(app.page, 'maintenance-page')
    expect(await app.page.$('[data-testid="collections-grid"]')).toBeNull()
  })
})

describe('not found', () => {
  it('shows the not-found page for an unknown path and links home', async () => {
    app = await launchApp({ path: '/nothing-here', builder })
    await waitForTestId(app.page, 'not-found-page')
    await app.waitForEvent('Not found page')
    await clickTestId(app.page, 'not-found-home')
    await waitForTestId(app.page, 'overview-page')
  })

  it('treats the live preview as not found while its flag is off', async () => {
    app = await launchApp({ path: '/live-preview', builder })
    await waitForTestId(app.page, 'not-found-page')
  })
})

describe('served under /create', () => {
  it('routes the same pages below the /create base path', async () => {
    app = await launchApp({ path: '/create/collections', builder })
    await waitForTestId(app.page, 'collections-grid')
    expect(new URL(app.page.url()).pathname).toBe('/create/collections')
    expect(app.pageViews()).toContain('collections')
  })
})

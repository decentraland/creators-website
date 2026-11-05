import { type ElementHandle, type Page } from 'puppeteer'

export const byTestId = (id: string) => `[data-testid="${id}"]`

/** Case-insensitive, so it matches text-transformed UI. */
export async function waitForText(page: Page, text: string, timeout = 20_000): Promise<void> {
  await page.waitForFunction(
    (t: string) => document.body.innerText.toLowerCase().includes(t.toLowerCase()),
    { timeout },
    text
  )
}

export async function waitForTestId(page: Page, id: string, timeout = 20_000): Promise<ElementHandle<Element>> {
  const handle = await page.waitForSelector(byTestId(id), { timeout, visible: true })
  if (!handle) throw new Error(`[data-testid="${id}"] never appeared`)
  return handle
}

export async function clickTestId(page: Page, id: string, timeout = 20_000): Promise<void> {
  await (await waitForTestId(page, id, timeout)).click()
}

/** The `data-testid` values currently on the page that start with `prefix`. */
export async function testIdsStartingWith(page: Page, prefix: string): Promise<string[]> {
  return page.$$eval(`[data-testid^="${prefix}"]`, els => els.map(el => el.getAttribute('data-testid') ?? ''))
}

/** Picks files in the next file chooser the page opens after `trigger`. */
export async function uploadFiles(page: Page, trigger: () => Promise<void>, paths: string[]): Promise<void> {
  const [chooser] = await Promise.all([page.waitForFileChooser({ timeout: 10_000 }), trigger()])
  await chooser.accept(paths)
}

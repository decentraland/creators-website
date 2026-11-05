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

/** Opens a `~/components/Select` and picks the option with `value`. */
export async function selectOption(page: Page, testId: string, value: string): Promise<void> {
  await clickTestId(page, testId)
  await clickTestId(page, `${testId}-option-${value}`)
}

/** The values a `~/components/Select` offers, read from its open listbox (closed again afterwards). */
export async function selectOptions(page: Page, testId: string): Promise<string[]> {
  await clickTestId(page, testId)
  await waitForTestId(page, `${testId}-listbox`)
  const values = await testIdsStartingWith(page, `${testId}-option-`)
  await page.keyboard.press('Escape')
  return values.map(id => id.slice(`${testId}-option-`.length))
}

/** Waits until the element is present and enabled (neither `disabled` nor `aria-disabled`). */
export async function waitForEnabled(page: Page, id: string, timeout = 20_000): Promise<void> {
  await page.waitForFunction(
    (selector: string) => {
      const el = document.querySelector(selector)
      return !!el && !el.hasAttribute('disabled') && el.getAttribute('aria-disabled') !== 'true'
    },
    { timeout },
    byTestId(id)
  )
}

/** Picks files in the next file chooser the page opens after `trigger`. */
export async function uploadFiles(page: Page, trigger: () => Promise<void>, paths: string[]): Promise<void> {
  const [chooser] = await Promise.all([page.waitForFileChooser({ timeout: 10_000 }), trigger()])
  await chooser.accept(paths)
}

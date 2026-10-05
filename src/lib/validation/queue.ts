// Caps how many validations download and parse at once: a 50-item collection must not fetch 50 models in parallel.
export const MAX_CONCURRENT = 2

let running = 0
const waiting: Array<() => void> = []

/** Runs `task` once a slot frees up. A run whose signal aborted while it waited is dropped without starting. */
export async function limited<T>(task: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  if (running >= MAX_CONCURRENT) await new Promise<void>(resolve => waiting.push(resolve))
  running++
  try {
    signal?.throwIfAborted()
    return await task()
  } finally {
    running--
    waiting.shift()?.()
  }
}

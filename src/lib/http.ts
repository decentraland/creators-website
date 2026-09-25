/** A response that arrived with a non-2xx status: the server's problem, unlike a request that never landed. */
export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(`${message} (${status})`)
    this.name = 'HttpError'
  }
}

/** A request that never got a response: offline, CORS or an ad blocker. */
export class NetworkError extends Error {
  constructor(readonly cause: unknown) {
    super(cause instanceof Error ? cause.message : 'network request failed')
    this.name = 'NetworkError'
  }
}

/** `fetch`, with a rejection wrapped in `NetworkError` so it can be told apart from a bug in the caller. */
export async function fetchOrNetworkError(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init)
  } catch (error) {
    if (isNetworkError(error)) throw error
    throw new NetworkError(error)
  }
}

/** The visitor's network (no response, a timeout or an abort), not a bug: not worth an error report. */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof NetworkError) return true
  const name = (error as { name?: unknown } | null)?.name
  return name === 'AbortError' || name === 'TimeoutError'
}

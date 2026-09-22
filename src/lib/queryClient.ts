import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { captureError } from '~/lib/monitoring'
import { isWalletRejection } from '~/lib/walletErrors'

/**
 * The app's QueryClient. react-query swallows every query and mutation failure (it becomes `error`
 * state, never an unhandled rejection), so without these cache-level hooks nothing that fails while
 * talking to builder-server or the chain would ever reach Sentry.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
    queryCache: new QueryCache({
      onError: (error, query) => captureError(error, { flow: 'query', query_key: keyOf(query.queryKey) })
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        // Dismissing the wallet prompt is a choice, not a failure.
        if (isWalletRejection(error)) return
        captureError(error, { flow: 'mutation', mutation_key: keyOf(mutation.options.mutationKey) })
      }
    })
  })
}

/** A key as a readable string — a mutation may have none. */
function keyOf(key: readonly unknown[] | undefined): string | undefined {
  if (!key || key.length === 0) return undefined
  return key.map(part => (typeof part === 'object' && part !== null ? JSON.stringify(part) : String(part))).join('/')
}

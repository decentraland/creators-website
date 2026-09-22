import { useEffect, useState } from 'react'
import { pollCreditsOrder, type CreditsOrderOutcome } from '~/lib/credits'

export type OrderOutcomeState = { status: 'confirming' } | CreditsOrderOutcome

/**
 * Follows a credit-pack order after the Stripe return until the webhook settles it. A network failure
 * reads as `pending`: the payment may well have gone through, and the balance query catches up on its own.
 */
export function useCreditsOrderOutcome(address: string, orderId: string): OrderOutcomeState {
  const [state, setState] = useState<OrderOutcomeState>({ status: 'confirming' })

  useEffect(() => {
    const controller = new AbortController()
    setState({ status: 'confirming' })
    pollCreditsOrder(address, orderId, { signal: controller.signal })
      .then(outcome => {
        if (!controller.signal.aborted) setState(outcome)
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: 'pending' })
      })
    return () => controller.abort()
  }, [address, orderId])

  return state
}

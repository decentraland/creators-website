import { create } from 'zustand'
import { identify, reset as resetAnalytics, track } from '~/lib/analytics'
import { logout, restoreSession, signInRedirect, type Session } from '~/lib/auth'
import { setMonitoringUser } from '~/lib/monitoring'

// The IN-FLIGHT silent restore, so concurrent callers share one pass rather than racing. Cleared once
// it settles — it dedupes overlapping calls, it is not a run-once latch.
let restoring: Promise<void> | undefined

type WalletState = {
  session: Session | null
  /**
   * Has the silent restore finished, whatever its outcome? `session === null` alone can't distinguish
   * "this visitor has no wallet" from "we have not looked yet".
   */
  restored: boolean
  connecting: boolean
  signIn: () => void
  disconnect: () => Promise<void>
  restore: () => Promise<void>
}

export const useWallet = create<WalletState>((set, get) => ({
  session: null,
  restored: false,
  connecting: false,
  // Redirect to the auth app; the user picks wallet / Magic there.
  signIn: () => {
    // The attempt, not its outcome — the app navigates away and comes back through `restore`.
    track('Login')
    signInRedirect()
  },
  disconnect: async () => {
    track('Logout')
    await logout(get().session?.address)
    set({ session: null })
    // Drops the identity↔anonymousId link so the next account isn't attributed to this one.
    resetAnalytics()
    setMonitoringUser(null)
  },
  // Silent restore on load (reads connection + stored identity, no popup). Deduped so any mount point
  // can fire it freely.
  restore: async () => {
    if (restoring) return restoring
    set({ connecting: true })
    // The catch keeps the store from wedging at connecting:true if restoreSession ever rejects
    // (e.g. the dynamic import of decentraland-connect fails).
    restoring = restoreSession()
      .catch(() => null)
      .then(session => {
        set({ session, restored: true, connecting: false })
        if (session) {
          identify(session.address, { provider_type: session.providerType })
          setMonitoringUser(session.address)
        }
      })
      .finally(() => {
        restoring = undefined
      })
    return restoring
  }
}))

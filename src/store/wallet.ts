import { create } from 'zustand'
import { logout, restoreSession, signInRedirect, type Session } from '~/lib/auth'

// Set right before the auth redirect so on return we can tell a fresh sign-in from a silent restore.
const SIGNING_IN_FLAG = 'wemotes:signing_in'

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
    try {
      sessionStorage.setItem(SIGNING_IN_FLAG, '1')
    } catch {
      // ignore storage failures — we just lose the fresh-vs-restore distinction
    }
    signInRedirect()
  },
  disconnect: async () => {
    await logout(get().session?.address)
    set({ session: null })
  },
  // Silent restore on load (reads connection + stored identity, no popup). Deduped so any mount point
  // can fire it freely.
  restore: async () => {
    if (restoring) return restoring
    restoring = (async () => {
      set({ connecting: true })
      const session = await restoreSession()
      try {
        sessionStorage.removeItem(SIGNING_IN_FLAG)
      } catch {
        // ignore
      }
      set({ session, restored: true, connecting: false })
    })().finally(() => {
      restoring = undefined
    })
    return restoring
  }
}))

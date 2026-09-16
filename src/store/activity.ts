import { create } from 'zustand'
import { type ActivityEvent, type ActivityStatus } from '~/lib/activity'

// Transactions this tab sent, kept only in memory: the server is the log, this is what bridges the gap
// until it lists them (and what the nav badge reads while one is mining).
type ActivityState = {
  local: ActivityEvent[]
  add: (event: ActivityEvent) => void
  /** Swaps the local copy for the server's once it is stored. */
  replace: (txHash: string, event: ActivityEvent) => void
  settle: (txHash: string, status: ActivityStatus) => void
  clear: () => void
}

const sameHash = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

export const useActivityStore = create<ActivityState>(set => ({
  local: [],
  add: event => set(state => ({ local: [event, ...state.local.filter(e => !sameHash(e.txHash, event.txHash))] })),
  replace: (txHash, event) =>
    set(state => ({
      local: state.local.map(e => (sameHash(e.txHash, txHash) ? { ...event, status: e.status } : e))
    })),
  settle: (txHash, status) =>
    set(state => ({ local: state.local.map(e => (sameHash(e.txHash, txHash) ? { ...e, status } : e)) })),
  clear: () => set({ local: [] })
}))

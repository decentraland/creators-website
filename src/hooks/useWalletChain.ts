import { useCallback, useEffect, useMemo, useState } from 'react'
// @dcl/schemas' root barrel doesn't re-export `getNetwork` / `getNetworkMapping`.
import { ChainId, getNetwork, getNetworkMapping } from '@dcl/schemas/dist/dapps/chain-id'
import { Network } from '@dcl/schemas/dist/dapps/network'
import { readWalletChainId, subscribeWalletChain, switchWalletChain, type Session } from '~/lib/auth'
import { captureError } from '~/lib/monitoring'
import { config } from '~/config'

/** The wallet declined the request: an answer, not an error. */
const USER_REJECTED = 4001

const KNOWN_CHAINS = Object.values(ChainId).filter((id): id is ChainId => typeof id === 'number')

/**
 * The networks this deployment can transact on: its Polygon chain first, then the Ethereum chain
 * @dcl/schemas pairs it with. Derived rather than listed so a testnet deployment never offers mainnet.
 */
export function supportedChains(polygonChainId: number = Number(config.get('MATIC_CHAIN_ID'))): number[] {
  const counterpart = KNOWN_CHAINS.find(id => {
    try {
      return getNetwork(id) === Network.ETHEREUM && Number(getNetworkMapping(id)[Network.MATIC]) === polygonChainId
    } catch {
      return false
    }
  })
  return counterpart !== undefined && Number(counterpart) !== polygonChainId
    ? [polygonChainId, Number(counterpart)]
    : [polygonChainId]
}

export type WalletChain = {
  /** The wallet's current chain, or undefined until the first read resolves or without a wallet. */
  chainId?: number
  /** Networks offered for this deployment. */
  chains: number[]
  /** The chain a switch is awaiting the wallet's answer for, if any. */
  pendingChainId?: number
  /** Asks the wallet to switch. Call ONLY from a user gesture; resolves once the wallet answers either way. */
  switchTo: (chainId: number) => Promise<void>
}

/**
 * Which network the wallet is on, and moving it only when the user asked. Nothing here switches on its own:
 * wallets reject `wallet_*` requests they can't attribute to a click. Pass null for a wallet that has no
 * network to choose (social logins), so nothing is asked and the navbar hides its chain pill.
 */
export function useWalletChain(session: Session | null): WalletChain {
  const [chainId, setChainId] = useState<number | undefined>(session?.chainId)
  const [pendingChainId, setPendingChainId] = useState<number | undefined>()
  const chains = useMemo(() => supportedChains(), [])

  // First read, then the wallet's own events. A failed read keeps the last known value: a wallet that
  // won't answer is not evidence of a different chain.
  useEffect(() => {
    if (!session) {
      setChainId(undefined)
      return
    }
    let live = true
    const refresh = () => {
      readWalletChainId(session)
        .then(next => {
          if (live) setChainId(next)
        })
        .catch((error: unknown) => captureError(error, { flow: 'network-selector', step: 'read-chain' }))
    }
    refresh()
    const unsubscribe = subscribeWalletChain(session, () => {
      setPendingChainId(undefined)
      refresh()
    })
    return () => {
      live = false
      unsubscribe()
    }
  }, [session])

  const switchTo = useCallback(
    async (target: number) => {
      // One request in flight: a second click would make the first answer look like the second's.
      if (!session || target === chainId || pendingChainId !== undefined) return
      setPendingChainId(target)
      try {
        await switchWalletChain(session, target)
        // Some wallets emit no `chainChanged` for a switch they consider a no-op, so confirm once.
        setChainId(await readWalletChainId(session))
      } catch (error) {
        if ((error as { code?: number }).code !== USER_REJECTED) {
          captureError(error, { flow: 'network-selector', step: 'switch-chain', target })
        }
      } finally {
        setPendingChainId(undefined)
      }
    },
    [session, chainId, pendingChainId]
  )

  return { chainId, chains, pendingChainId, switchTo }
}

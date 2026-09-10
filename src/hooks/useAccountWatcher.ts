import { useEffect } from 'react'
import { ProviderType } from '@dcl/schemas'
import { useWallet } from '~/store/wallet'

type Eip1193 = {
  on?: (event: string, cb: (...args: unknown[]) => void) => void
  removeListener?: (event: string, cb: (...args: unknown[]) => void) => void
}

// When the user switches (or disconnects) the account in an injected wallet, everything already fetched
// and every signed request belongs to the previous account. Rather than purging each query and store by
// hand, reload the page: that re-runs the silent restore for the now-active account from scratch.
// Only injected wallets emit accountsChanged; Magic sessions don't switch accounts this way.
export function useAccountWatcher() {
  const session = useWallet(s => s.session)

  useEffect(() => {
    if (!session || session.providerType !== ProviderType.INJECTED) return

    const provider = session.web3Provider.provider as Eip1193 | undefined
    if (!provider?.on || !provider.removeListener) return

    const current = session.address.toLowerCase()

    const onAccountsChanged = (...args: unknown[]) => {
      const accounts = (args[0] as string[] | undefined) ?? []
      const next = accounts[0]?.toLowerCase()
      if (next === current) return
      window.location.reload()
    }

    provider.on('accountsChanged', onAccountsChanged)
    return () => provider.removeListener?.('accountsChanged', onAccountsChanged)
  }, [session])
}

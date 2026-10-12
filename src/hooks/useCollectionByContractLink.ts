import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { track } from '~/lib/analytics'
import { fetchAllCollections } from '~/lib/builder'
import { findCollectionByContract } from '~/lib/collections'

export const CONTRACT_PARAM = 'contract'

/**
 * Opens the collection named by `?contract=<address>`, the link other apps (marketplace) have only a contract
 * address for. A signed-out visitor keeps the param through sign-in; no match drops it and stays on the list.
 */
export function useCollectionByContractLink(address: string | undefined): { isResolving: boolean } {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const contract = searchParams.get(CONTRACT_PARAM)

  // Only an unpaginated read can match a contract address: builder-server searches by name only.
  const collections = useQuery({
    queryKey: ['collections', address, 'all'],
    queryFn: () => fetchAllCollections(address!),
    enabled: !!address && !!contract
  })

  useEffect(() => {
    if (!contract || !address || collections.isPending) return
    const match = collections.data ? findCollectionByContract(collections.data, contract) : undefined
    track('Open collection by contract', { found: !!match, ...(match && { collectionId: match.id }) })
    if (match) {
      navigate(`/collections/${match.id}`, { replace: true })
      return
    }
    setSearchParams(
      prev => {
        const next = new URLSearchParams(prev)
        next.delete(CONTRACT_PARAM)
        return next
      },
      { replace: true }
    )
  }, [contract, address, collections.isPending, collections.data, navigate, setSearchParams])

  return { isResolving: !!contract && !!address && collections.isPending }
}

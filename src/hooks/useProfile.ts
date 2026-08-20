import { useQuery } from '@tanstack/react-query'
import { config } from '~/config'

// The subset of the Catalyst profile the ui2 Navbar `avatar` prop consumes.
export type ProfileAvatar = {
  name?: string
  hasClaimedName?: boolean
  ethAddress?: string
  avatar?: {
    snapshots?: { face256?: string; body?: string }
  }
}

// Returns the first avatar, or undefined when the profile is missing (404) — callers treat "no
// profile" the same as "not ok".
async function fetchProfile(address: string): Promise<ProfileAvatar | undefined> {
  const res = await fetch(`${config.get('PEER_URL')}/lambdas/profiles/${address.toLowerCase()}`)
  if (!res.ok) return undefined
  const profile = (await res.json()) as { avatars?: ProfileAvatar[] }
  return profile?.avatars?.[0]
}

export function useProfile(address?: string) {
  return useQuery({
    queryKey: ['profile', address],
    enabled: !!address,
    staleTime: 5 * 60_000,
    queryFn: (): Promise<ProfileAvatar | undefined> => fetchProfile(address!)
  })
}

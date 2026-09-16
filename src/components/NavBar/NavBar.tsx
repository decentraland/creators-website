import { useEffect, useMemo, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Network } from '@dcl/schemas'
import { ethers } from 'ethers'
import { History as HistoryIcon } from '@mui/icons-material'
import { TopNav } from '~/components/TopNav'
import { useWallet } from '~/store/wallet'
import { useActivityStore } from '~/store/activity'
import { hasPendingActivity } from '~/lib/activity'
import { useCreditsBalance, useManaBalance } from '~/hooks/useBalances'
import { useProfile } from '~/hooks/useProfile'
import { openExternal } from '~/lib/navigation'
import { useTranslation } from '~/intl'
import { config } from '~/config'
import * as S from './NavBar.styles'

// Overview (the creator home) lives in the sites repo at /create, and Scenes and Land in the legacy
// builder web app — none of them are routes of this SPA, so all three are plain same-tab links.
const builderUrl = config.get('BUILDER_URL')
const createUrl = config.get('CREATE_URL')
const shopCreditsUrl = `${config.get('SHOP_URL')}/credits`
const accountUrl = config.get('ACCOUNT_URL')

const NavBar = () => {
  const { t } = useTranslation()
  const { session, connecting, signIn, disconnect } = useWallet()
  const address = session?.address
  const { data: avatar, isLoading: isLoadingProfile } = useProfile(address)
  const { data: credits } = useCreditsBalance(address)
  const { data: manaWei } = useManaBalance(address)
  // Polygon only: it's the network publishing pays on. Like the legacy builder, an empty wallet shows
  // no MANA chip at all; ui2 renders whole units.
  const manaBalances = useMemo(
    () => (manaWei ? { [Network.MATIC]: Number(ethers.utils.formatEther(manaWei)) } : undefined),
    [manaWei]
  )
  const { pathname } = useLocation()
  // Lights the Activity entry while a transaction sent from this tab is still mining.
  const hasPending = useActivityStore(state => hasPendingActivity(state.local))
  // Collections stays active across the collection detail / item detail / editor pages too, not just
  // the /collections list — a NavLink to /collections alone wouldn't light up on the nested routes.
  const collectionsActive = /^\/collections(\/|$)/.test(pathname)
  // The translucent band washes out over light content, so it deepens once the page scrolls.
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => {
      const v = window.scrollY > 8
      setScrolled(v)
      // Mirrored on <body> so the global ui2 navbar (styled from TopNav via ancestor selectors,
      // outside this component) can deepen in step with the sub-nav.
      document.body.toggleAttribute('data-scrolled', v)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      document.body.removeAttribute('data-scrolled')
    }
  }, [])

  return (
    <>
      <TopNav
        activePage="create"
        isSignedIn={!!session}
        isSigningIn={connecting}
        isLoadingProfile={!!session && isLoadingProfile}
        address={address}
        avatar={avatar}
        shopCreditsBalance={credits?.credits}
        onClickShopCredits={() => openExternal(shopCreditsUrl)}
        manaBalances={manaBalances}
        showManaBalancesInNavbar
        onClickBalance={() => openExternal(accountUrl)}
        onClickSignIn={() => signIn()}
        onClickSignOut={() => void disconnect()}
      />

      <S.Subnav data-testid="subnav" data-scrolled={scrolled || undefined}>
        <S.Tabs data-testid="subnav-tabs">
          <a href={createUrl}>{t('nav.overview')}</a>
          <NavLink to="/collections" className={() => (collectionsActive ? 'active' : '')}>
            {t('nav.collections')}
          </NavLink>
          <a href={`${builderUrl}/scenes`}>{t('nav.scenes')}</a>
          <a href={`${builderUrl}/land`}>{t('nav.land')}</a>
        </S.Tabs>
        {session && (
          <S.ActivityLink to="/activity" data-testid="subnav-activity" data-pending={hasPending || undefined}>
            <HistoryIcon fontSize="small" />
            <span>{t('nav.activity')}</span>
          </S.ActivityLink>
        )}
      </S.Subnav>
    </>
  )
}

export { NavBar }

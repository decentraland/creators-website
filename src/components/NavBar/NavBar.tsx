import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { TopNav } from '~/components/TopNav'
import { useWallet } from '~/store/wallet'
import { useProfile } from '~/hooks/useProfile'
import { useTranslation } from '~/intl'
import { config } from '~/config'
import * as S from './NavBar.styles'

// Overview (the creator home) lives in the sites repo at /create, and Scenes and Land in the legacy
// builder web app — none of them are routes of this SPA, so all three are plain same-tab links.
const builderUrl = config.get('BUILDER_URL')
const createUrl = config.get('CREATE_URL')

const NavBar = () => {
  const { t } = useTranslation()
  const { session, connecting, signIn, disconnect } = useWallet()
  const address = session?.address
  const { data: avatar, isLoading: isLoadingProfile } = useProfile(address)
  const { pathname } = useLocation()
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
      </S.Subnav>
    </>
  )
}

export { NavBar }

import { lazy, Suspense, useEffect, useRef } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { ErrorBoundary } from '~/components/ErrorBoundary'
import { Footer } from '~/components/Footer'
import { Intercom } from '~/components/Intercom'
import { MaintenancePage } from '~/components/MaintenancePage'
import { NavBar } from '~/components/NavBar'
import { OverviewPage } from '~/components/OverviewPage'
import { Toasts } from '~/components/Toasts'
import { TranslationProvider } from '~/intl'
import { FeatureFlag } from '~/lib/featureFlags'
import { trackPageView } from '~/lib/pageViews'
import { useAccountWatcher } from '~/hooks/useAccountWatcher'
import { useCreatorsPrelaunch } from '~/hooks/useCreatorsPrelaunch'
import { useFeatureFlag } from '~/hooks/useFeatureFlag'
import { useWallet } from '~/store/wallet'

// The overview (the landing route) stays eager for the fastest first paint; every other route is code-split.
const CollectionsPage = lazy(() => import('~/components/CollectionsPage').then(m => ({ default: m.CollectionsPage })))
const CollectionDetailPage = lazy(() =>
  import('~/components/CollectionDetailPage').then(m => ({ default: m.CollectionDetailPage }))
)
const ItemEditorPage = lazy(() => import('~/components/ItemEditorPage').then(m => ({ default: m.ItemEditorPage })))
const CurationPage = lazy(() => import('~/components/CurationPage').then(m => ({ default: m.CurationPage })))
const LivePreviewPage = lazy(() => import('~/components/LivePreviewPage').then(m => ({ default: m.LivePreviewPage })))
const NotFoundPage = lazy(() => import('~/components/NotFoundPage').then(m => ({ default: m.NotFoundPage })))

const PageFallback = () => {
  return (
    <div className="page-loading" aria-busy="true">
      <span className="spinner" aria-hidden />
    </div>
  )
}

// Fullscreen workspaces: no navbar, no footer, no page scroll.
const FULLSCREEN_PATHS = ['/collections/editor', '/live-preview']

const App = () => {
  const location = useLocation()
  const maintenance = useFeatureFlag(FeatureFlag.MAINTENANCE)
  const livePreview = useFeatureFlag(FeatureFlag.BLENDER_LIVE_PREVIEW)
  // Behind the pre-launch gate only the overview exists; see `useCreatorsPrelaunch`.
  const prelaunch = useCreatorsPrelaunch()
  const path = location.pathname.replace(/\/+$/, '')
  // With its flag off the live preview route is a not-found page, which keeps the shell.
  const isFullscreen =
    prelaunch === 'open' &&
    !maintenance.enabled &&
    FULLSCREEN_PATHS.includes(path) &&
    (path !== '/live-preview' || livePreview.enabled)

  // Auth bootstrap lives at the app root so the silent session restore (and the return from /auth)
  // doesn't depend on any layout component staying mounted.
  const restore = useWallet(state => state.restore)
  useEffect(() => {
    void restore()
  }, [restore])
  useAccountWatcher()

  // Pagination and in-page filters update the query string only; a new pathname is a new page.
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [location.pathname])

  // One view per pathname (the gate re-deciding on the same page, as on sign-out, is not a new view). The overview
  // renders whatever the gate says, so it counts at once; any other page counts once the gate has let it render.
  // A curtained visitor is sent to the overview, which counts there.
  const seenPathname = useRef<string>()
  useEffect(() => {
    const isOverview = !path
    if (!isOverview && prelaunch !== 'open') return
    if (seenPathname.current === location.pathname) return
    seenPathname.current = location.pathname
    trackPageView(location.pathname)
  }, [location.pathname, path, prelaunch])

  useEffect(() => {
    if (isFullscreen) document.body.dataset.fullscreen = ''
    else delete document.body.dataset.fullscreen
    // The flag belongs to this mount: an unmount (StrictMode, HMR) must not leave the shell hidden.
    return () => {
      delete document.body.dataset.fullscreen
    }
  }, [isFullscreen])

  // Mirrored on <body> so shell-level CSS (the page field behind the fixed navbar) can vary per route.
  useEffect(() => {
    document.body.dataset.route = path || '/'
    return () => {
      delete document.body.dataset.route
    }
  }, [path])

  // Behind the gate there is no sub-nav, so everything sized against it (hero, violet strip) collapses the gap.
  useEffect(() => {
    if (prelaunch === 'open') delete document.body.dataset.noSubnav
    else document.body.dataset.noSubnav = ''
    return () => {
      delete document.body.dataset.noSubnav
    }
  }, [prelaunch])

  return (
    <TranslationProvider>
      {!isFullscreen && <NavBar subnav={prelaunch === 'open'} />}
      {/* The route is exposed so a page can opt out of shell-level CSS by path if it ever needs to. */}
      <main className="page" data-route={location.pathname} data-fullscreen={isFullscreen || undefined}>
        <ErrorBoundary>
          {maintenance.enabled ? (
            <MaintenancePage />
          ) : (
            <Suspense fallback={<PageFallback />}>
              <Routes>
                <Route path="/" element={<OverviewPage />} />
                <Route path="/overview" element={<Navigate to="/" replace />} />
                {prelaunch === 'open' ? (
                  <>
                    <Route path="/collections" element={<CollectionsPage />} />
                    <Route path="/collections/editor" element={<ItemEditorPage />} />
                    <Route path="/collections/:collectionId" element={<CollectionDetailPage />} />
                    <Route path="/curation" element={<CurationPage />} />
                    <Route
                      path="/live-preview"
                      element={
                        livePreview.enabled ? (
                          <LivePreviewPage />
                        ) : livePreview.isLoading ? (
                          <PageFallback />
                        ) : (
                          <NotFoundPage />
                        )
                      }
                    />
                    <Route path="*" element={<NotFoundPage />} />
                  </>
                ) : (
                  <Route
                    path="*"
                    element={
                      prelaunch === 'pending' ? (
                        <PageFallback />
                      ) : (
                        // The query string survives so campaign parameters reach the overview's page view.
                        <Navigate to={{ pathname: '/', search: location.search }} replace />
                      )
                    }
                  />
                )}
              </Routes>
            </Suspense>
          )}
        </ErrorBoundary>
      </main>
      {!isFullscreen && <Footer />}
      <Toasts />
      <Intercom />
    </TranslationProvider>
  )
}

export { App }

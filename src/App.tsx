import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { ErrorBoundary } from '~/components/ErrorBoundary'
import { Footer } from '~/components/Footer'
import { Intercom } from '~/components/Intercom'
import { MaintenancePage } from '~/components/MaintenancePage'
import { NavBar } from '~/components/NavBar'
import { OverviewPage } from '~/components/OverviewPage'
import { Toasts } from '~/components/Toasts'
import { TranslationProvider } from '~/intl'
import { trackPage } from '~/lib/analytics'
import { FeatureFlag } from '~/lib/featureFlags'
import { useAccountWatcher } from '~/hooks/useAccountWatcher'
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

// Stable page names for the funnel: a raw pathname carries collection ids and would never group.
const PAGE_NAMES: Record<string, string> = {
  '/': 'overview',
  '/collections': 'collections',
  '/collections/editor': 'item_editor',
  '/curation': 'curation',
  '/live-preview': 'live_preview'
}

function pageName(pathname: string): string {
  const path = pathname.replace(/\/+$/, '') || '/'
  return PAGE_NAMES[path] ?? (path.startsWith('/collections/') ? 'collection_detail' : 'other')
}

const App = () => {
  const location = useLocation()
  const maintenance = useFeatureFlag(FeatureFlag.MAINTENANCE)
  const livePreview = useFeatureFlag(FeatureFlag.BLENDER_LIVE_PREVIEW)
  const path = location.pathname.replace(/\/+$/, '')
  // With its flag off the live preview route is a not-found page, which keeps the shell.
  const isFullscreen =
    !maintenance.enabled && FULLSCREEN_PATHS.includes(path) && (path !== '/live-preview' || livePreview.enabled)

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
    trackPage(pageName(location.pathname))
  }, [location.pathname])

  useEffect(() => {
    if (isFullscreen) document.body.dataset.fullscreen = ''
    else delete document.body.dataset.fullscreen
    // The flag belongs to this mount: an unmount (StrictMode, HMR) must not leave the shell hidden.
    return () => {
      delete document.body.dataset.fullscreen
    }
  }, [isFullscreen])

  return (
    <TranslationProvider>
      {!isFullscreen && <NavBar />}
      {/* The route is exposed so a page can opt out of shell-level CSS by path if it ever needs to. */}
      <main className="page" data-route={location.pathname} data-fullscreen={isFullscreen || undefined}>
        <ErrorBoundary>
          {maintenance.enabled ? (
            <MaintenancePage />
          ) : (
            <Suspense fallback={<PageFallback />}>
              <Routes>
                <Route path="/" element={<OverviewPage />} />
                {/* Backward-compat: the overview used to live at /overview. */}
                <Route path="/overview" element={<Navigate to="/" replace />} />
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

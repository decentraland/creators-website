import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { CollectionsPage } from '~/components/CollectionsPage'
import { ErrorBoundary } from '~/components/ErrorBoundary'
import { Footer } from '~/components/Footer'
import { NavBar } from '~/components/NavBar'
import { Toasts } from '~/components/Toasts'
import { TranslationProvider } from '~/intl'
import { useAccountWatcher } from '~/hooks/useAccountWatcher'
import { useWallet } from '~/store/wallet'

// Collections (the landing route) stays eager for the fastest first paint; every other route is code-split.
const CollectionDetailPage = lazy(() =>
  import('~/components/CollectionDetailPage').then(m => ({ default: m.CollectionDetailPage }))
)
const ItemEditorPage = lazy(() => import('~/components/ItemEditorPage').then(m => ({ default: m.ItemEditorPage })))
const CurationPage = lazy(() => import('~/components/CurationPage').then(m => ({ default: m.CurationPage })))
const NotFoundPage = lazy(() => import('~/components/NotFoundPage').then(m => ({ default: m.NotFoundPage })))

const PageFallback = () => {
  return (
    <div className="page-loading" aria-busy="true">
      <span className="spinner" aria-hidden />
    </div>
  )
}

const App = () => {
  const location = useLocation()

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

  return (
    <TranslationProvider>
      <NavBar />
      {/* The route is exposed so a page can opt out of shell-level CSS by path if it ever needs to. */}
      <main className="page" data-route={location.pathname}>
        <ErrorBoundary>
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/" element={<Navigate to="/collections" replace />} />
              {/* Backward-compat: the old overview route now lives in sites; old links land on collections. */}
              <Route path="/overview" element={<Navigate to="/collections" replace />} />
              <Route path="/collections" element={<CollectionsPage />} />
              <Route path="/collections/editor" element={<ItemEditorPage />} />
              <Route path="/collections/:collectionId" element={<CollectionDetailPage />} />
              <Route path="/curation" element={<CurationPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>
      <Footer />
      <Toasts />
    </TranslationProvider>
  )
}

export { App }

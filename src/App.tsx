import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { ErrorBoundary } from '~/components/ErrorBoundary'
import { Footer } from '~/components/Footer'
import { NavBar } from '~/components/NavBar'
import { OverviewPage } from '~/components/OverviewPage'
import { TranslationProvider } from '~/intl'
import { useWallet } from '~/store/wallet'

// Overview (home) stays eager for the fastest first paint; every other route is code-split.
const CollectionsPage = lazy(() => import('~/components/CollectionsPage').then(m => ({ default: m.CollectionsPage })))
const CollectionDetailPage = lazy(() =>
  import('~/components/CollectionDetailPage').then(m => ({ default: m.CollectionDetailPage }))
)
const ItemDetailPage = lazy(() => import('~/components/ItemDetailPage').then(m => ({ default: m.ItemDetailPage })))
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

  return (
    <TranslationProvider>
      <NavBar />
      {/* The route is exposed so a page can opt out of shell-level CSS by path if it ever needs to. */}
      <main className="page" data-route={location.pathname}>
        <ErrorBoundary>
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/" element={<Navigate to="/overview" replace />} />
              <Route path="/overview" element={<OverviewPage />} />
              <Route path="/collections" element={<CollectionsPage />} />
              <Route path="/collections/editor" element={<ItemEditorPage />} />
              <Route path="/collections/:collectionId" element={<CollectionDetailPage />} />
              <Route path="/collections/:collectionId/items/:itemId" element={<ItemDetailPage />} />
              <Route path="/curation" element={<CurationPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>
      <Footer />
    </TranslationProvider>
  )
}

export { App }

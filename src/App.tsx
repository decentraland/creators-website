import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { OverviewPage } from '~/components/OverviewPage'
import { TranslationProvider } from '~/intl'

// Overview (home) stays eager for the fastest first paint; every other route is code-split.
const CollectionsPage = lazy(() => import('~/components/CollectionsPage').then(m => ({ default: m.CollectionsPage })))
const CollectionDetailPage = lazy(() =>
  import('~/components/CollectionDetailPage').then(m => ({ default: m.CollectionDetailPage }))
)
const ItemDetailPage = lazy(() => import('~/components/ItemDetailPage').then(m => ({ default: m.ItemDetailPage })))
const ItemEditorPage = lazy(() => import('~/components/ItemEditorPage').then(m => ({ default: m.ItemEditorPage })))
const CurationPage = lazy(() => import('~/components/CurationPage').then(m => ({ default: m.CurationPage })))
const NotFoundPage = lazy(() => import('~/components/NotFoundPage').then(m => ({ default: m.NotFoundPage })))

const App = () => {
  return (
    <TranslationProvider>
      <Suspense fallback={null}>
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
    </TranslationProvider>
  )
}

export { App }

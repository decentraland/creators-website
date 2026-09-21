import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { basePath } from '~/config'
import { initAnalytics } from '~/lib/analytics'
import { initSentry } from '~/lib/monitoring'
import { App } from './App'
import '~/styles/index.css'

initSentry()
initAnalytics()

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={basePath}>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
)

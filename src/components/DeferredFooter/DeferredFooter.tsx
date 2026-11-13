import { lazy, Suspense } from 'react'
import { useAfterLoadIdle } from '~/hooks/useAfterLoadIdle'
import styles from './DeferredFooter.module.css'

const Footer = lazy(() => import('~/components/Footer').then(m => ({ default: m.Footer })))

/**
 * The site footer, fetched once the page has loaded and gone idle so its code and styles stay out of the first
 * paint. Not on scroll: crawlers that never scroll must still get its links.
 */
export function DeferredFooter() {
  const idle = useAfterLoadIdle()
  const placeholder = <div className={styles.placeholder} aria-hidden data-testid="footer-placeholder" />
  if (!idle) return placeholder
  return (
    <Suspense fallback={placeholder}>
      <Footer />
    </Suspense>
  )
}

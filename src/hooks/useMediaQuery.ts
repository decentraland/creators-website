import { useEffect, useState } from 'react'

// `theme.media.*` strings are CSS at-rules; matchMedia wants the bare condition.
const toCondition = (query: string) => query.replace(/^@media\s+/, '')

/** Whether a `theme.media` query currently matches; false where matchMedia is unavailable (tests, SSR). */
export function useMediaQuery(query: string): boolean {
  const condition = toCondition(query)
  const [matches, setMatches] = useState(() => window.matchMedia?.(condition).matches ?? false)

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const media = window.matchMedia(condition)
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches)
    setMatches(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [condition])

  return matches
}

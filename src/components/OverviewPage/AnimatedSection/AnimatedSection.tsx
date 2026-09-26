import type { ReactNode } from 'react'
import { useInView } from 'react-intersection-observer'
import { useSectionViewed } from '~/hooks/useSectionViewed'
import type { OverviewSection } from '~/lib/overviewAnalytics'
import * as S from './AnimatedSection.styles'

type AnimatedSectionProps = {
  section: OverviewSection
  children: ReactNode
  /** How much of the section must be visible before it reveals; also when `Section Viewed` fires. */
  threshold?: number
}

/** Slides its content into view the first time it is scrolled to, and reports the section as viewed. */
const AnimatedSection = ({ section, children, threshold = 0.1 }: AnimatedSectionProps) => {
  const { ref, inView } = useInView({ triggerOnce: true, threshold })
  useSectionViewed(section, inView)
  return (
    <S.Reveal ref={ref} data-testid={`overview-section-${section}`} data-visible={inView || undefined}>
      {children}
    </S.Reveal>
  )
}

export { AnimatedSection }

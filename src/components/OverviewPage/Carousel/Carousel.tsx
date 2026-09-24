import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon } from '@mui/icons-material'
import { useTranslation } from '~/intl'
import * as S from './Carousel.styles'

type CarouselProps<T> = {
  items: T[]
  renderItem: (item: T) => ReactNode
  keyExtractor: (item: T) => string
  /** Accessible name of the region. */
  label: string
  /** Desktop slide width in px; slides shrink to the viewport on narrow screens. */
  slideWidth: number
  /** Advance automatically every N ms; 0 disables. Pauses while hovered, focused or the tab is hidden. */
  autoplayMs?: number
}

/**
 * A row of slides scrolled one at a time. Scrolling is the browser's own (scroll-snap), so swiping on
 * touch devices and dragging a scrollbar work without any pointer maths; the arrows, dots and autoplay
 * just call `scrollTo`.
 */
function Carousel<T>({ items, renderItem, keyExtractor, label, slideWidth, autoplayMs = 0 }: CarouselProps<T>) {
  const { t } = useTranslation()
  const trackRef = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const total = items.length

  const slideStep = useCallback(() => {
    const track = trackRef.current
    const first = track?.firstElementChild as HTMLElement | null
    if (!track || !first) return 0
    return first.offsetWidth + parseFloat(getComputedStyle(track).columnGap || '0')
  }, [])

  const goTo = useCallback(
    (next: number) => {
      const target = ((next % total) + total) % total
      setIndex(target)
      // jsdom has no layout, hence the optional call.
      trackRef.current?.scrollTo?.({ left: target * slideStep(), behavior: 'smooth' })
    },
    [total, slideStep]
  )

  // A swipe or a scrollbar drag lands on a slide the buttons did not pick; follow it.
  const onScroll = useCallback(() => {
    const track = trackRef.current
    const step = slideStep()
    if (!track || step === 0) return
    const current = Math.round(track.scrollLeft / step)
    setIndex(Math.min(total - 1, Math.max(0, current)))
  }, [slideStep, total])

  useEffect(() => {
    if (!autoplayMs || paused || total < 2) return
    const timer = setInterval(() => {
      if (document.hidden) return
      goTo(index + 1)
    }, autoplayMs)
    return () => clearInterval(timer)
  }, [autoplayMs, paused, total, index, goTo])

  return (
    <S.Wrapper
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      data-testid="carousel"
      style={{ ['--slide-w' as string]: `${slideWidth}px` }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <S.Track ref={trackRef} onScroll={onScroll} data-testid="carousel-track">
        {items.map((item, i) => (
          <S.Slide
            key={keyExtractor(item)}
            data-testid="carousel-slide"
            data-active={i === index || undefined}
            aria-hidden={i !== index || undefined}
          >
            {renderItem(item)}
          </S.Slide>
        ))}
      </S.Track>
      {total > 1 && (
        <>
          <S.Arrow
            type="button"
            data-direction="prev"
            aria-label={t('overview.carousel.previous')}
            onClick={() => goTo(index - 1)}
          >
            <ChevronLeftIcon />
          </S.Arrow>
          <S.Arrow
            type="button"
            data-direction="next"
            aria-label={t('overview.carousel.next')}
            onClick={() => goTo(index + 1)}
          >
            <ChevronRightIcon />
          </S.Arrow>
          <S.Dots data-testid="carousel-dots">
            {items.map((item, i) => (
              <S.Dot
                key={keyExtractor(item)}
                type="button"
                data-active={i === index || undefined}
                aria-current={i === index || undefined}
                aria-label={t('overview.carousel.go_to', { index: i + 1 })}
                onClick={() => goTo(i)}
              />
            ))}
          </S.Dots>
        </>
      )}
    </S.Wrapper>
  )
}

export { Carousel }

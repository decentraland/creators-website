import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { TranslationProvider } from '~/intl'
import { Carousel } from './Carousel'

const items = [
  { id: 'a', text: 'Slide A' },
  { id: 'b', text: 'Slide B' },
  { id: 'c', text: 'Slide C' }
]

function renderCarousel(autoplayMs = 0) {
  return render(
    <TranslationProvider>
      <Carousel
        items={items}
        renderItem={item => <p>{item.text}</p>}
        keyExtractor={item => item.id}
        label="Testimonials"
        slideWidth={500}
        autoplayMs={autoplayMs}
      />
    </TranslationProvider>
  )
}

const activeSlide = () => screen.getAllByTestId('carousel-slide').find(slide => slide.hasAttribute('data-active'))

describe('Carousel', () => {
  it('shows every slide with the first one active', () => {
    renderCarousel()
    expect(screen.getByRole('region', { name: 'Testimonials' })).toBeInTheDocument()
    expect(screen.getAllByTestId('carousel-slide')).toHaveLength(3)
    expect(activeSlide()).toHaveTextContent('Slide A')
  })

  it('moves with the arrows, wrapping around at both ends, and jumps with the dots', () => {
    renderCarousel()
    fireEvent.click(screen.getByRole('button', { name: 'Next slide' }))
    expect(activeSlide()).toHaveTextContent('Slide B')

    fireEvent.click(screen.getByRole('button', { name: 'Previous slide' }))
    fireEvent.click(screen.getByRole('button', { name: 'Previous slide' }))
    expect(activeSlide()).toHaveTextContent('Slide C')

    fireEvent.click(screen.getByRole('button', { name: 'Go to slide 2' }))
    expect(activeSlide()).toHaveTextContent('Slide B')
    expect(screen.getByRole('button', { name: 'Go to slide 2' })).toHaveAttribute('aria-current', 'true')
  })

  describe('autoplay', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it('advances on its own and pauses while the pointer is over it', () => {
      renderCarousel(1000)
      act(() => {
        vi.advanceTimersByTime(1000)
      })
      expect(activeSlide()).toHaveTextContent('Slide B')

      fireEvent.mouseEnter(screen.getByTestId('carousel'))
      act(() => {
        vi.advanceTimersByTime(3000)
      })
      expect(activeSlide()).toHaveTextContent('Slide B')

      fireEvent.mouseLeave(screen.getByTestId('carousel'))
      act(() => {
        vi.advanceTimersByTime(1000)
      })
      expect(activeSlide()).toHaveTextContent('Slide C')
    })
  })
})

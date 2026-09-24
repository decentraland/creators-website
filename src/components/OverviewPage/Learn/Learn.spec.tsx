import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { TranslationProvider } from '~/intl'
import { track } from '~/lib/analytics'
import { Learn } from './Learn'

vi.mock('~/lib/analytics', () => ({ track: vi.fn() }))
vi.mock('react-intersection-observer', () => ({ useInView: () => ({ ref: vi.fn(), inView: true }) }))

beforeEach(() => vi.mocked(track).mockClear())

const renderSection = () =>
  render(
    <TranslationProvider>
      <Learn />
    </TranslationProvider>
  )

describe('Learn', () => {
  it('links every tutorial to its YouTube video with a spelled-out date and tracks the click', () => {
    renderSection()
    const cards = screen.getAllByTestId('overview-learn-card')
    expect(cards).toHaveLength(5)
    expect(cards[0]).toHaveAttribute('href', 'https://www.youtube.com/watch?v=6Q8FNyjFTxc')
    expect(cards[0]).toHaveTextContent('February 11, 2026')
    expect(cards[0]).toHaveTextContent('Blender for Beginners | Making Your First Hat')

    fireEvent.click(cards[0])
    expect(track).toHaveBeenCalledWith('Click', {
      place: 'Creators Learn',
      title: 'Blender for Beginners | Making Your First Hat'
    })
  })

  it('offers the channel and the tutorial submission form', () => {
    renderSection()
    expect(screen.getByTestId('overview-learn-youtube')).toHaveAttribute(
      'href',
      'https://www.youtube.com/@decentraland_foundation/videos'
    )
    expect(screen.getByTestId('overview-learn-submit')).toHaveAttribute(
      'href',
      expect.stringContaining('docs.google.com')
    )

    fireEvent.click(screen.getByTestId('overview-learn-submit'))
    expect(track).toHaveBeenCalledWith('Click', { place: 'Creators Learn', title: 'submit-tutorial' })
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { TranslationProvider } from '~/intl'
import { track } from '~/lib/analytics'
import { Faqs } from './Faqs'

vi.mock('~/lib/analytics', () => ({ track: vi.fn() }))

const viewport = vi.hoisted(() => ({ inView: false }))
vi.mock('react-intersection-observer', () => ({ useInView: () => ({ ref: vi.fn(), inView: viewport.inView }) }))

beforeEach(() => {
  viewport.inView = false
  vi.mocked(track).mockClear()
})

const renderSection = () =>
  render(
    <TranslationProvider>
      <Faqs />
    </TranslationProvider>
  )

describe('Faqs', () => {
  it('expands one question at a time and tracks only the expand', () => {
    renderSection()
    const [first, second] = screen.getAllByTestId('overview-faq')
    expect(first).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(first)
    expect(first).toHaveAttribute('aria-expanded', 'true')
    expect(first).toHaveAttribute('data-open')
    expect(track).toHaveBeenCalledWith('Click', { place: 'Creators Faqs', title: 'What is Decentraland?' })

    fireEvent.click(second)
    expect(first).toHaveAttribute('aria-expanded', 'false')
    expect(second).toHaveAttribute('aria-expanded', 'true')

    fireEvent.click(second)
    expect(second).toHaveAttribute('aria-expanded', 'false')
    expect(track).toHaveBeenCalledTimes(2)
  })

  it('toggles from the keyboard', () => {
    renderSection()
    const first = screen.getAllByTestId('overview-faq')[0]
    fireEvent.keyDown(first, { key: 'Enter' })
    expect(first).toHaveAttribute('aria-expanded', 'true')
    fireEvent.keyDown(first, { key: ' ' })
    expect(first).toHaveAttribute('aria-expanded', 'false')
    expect(track).toHaveBeenCalledTimes(1)
  })

  it('links to the docs FAQs and reports the section once it scrolls into view', () => {
    viewport.inView = true
    renderSection()
    const cta = screen.getByTestId('overview-faqs-cta')
    expect(cta).toHaveAttribute('href', 'https://docs.decentraland.org/faqs/')
    fireEvent.click(cta)
    expect(track).toHaveBeenCalledWith('Click', { place: 'Creators Faqs', title: 'faqs-cta' })
    expect(track).toHaveBeenCalledWith('Section Viewed', { section_viewed: 'Creators Faqs', mobile: false })
  })
})

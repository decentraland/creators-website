import { describe, it, expect, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TranslationProvider } from '~/intl'
import { useLocale } from '~/store/locale'
import { Footer } from './Footer'

function renderFooter() {
  return render(
    <TranslationProvider>
      <Footer />
    </TranslationProvider>
  )
}

beforeEach(() => {
  localStorage.clear()
  useLocale.setState({ locale: 'en' })
})

describe('Footer', () => {
  it('switches the site language from the language menu', async () => {
    renderFooter()
    await userEvent.click(screen.getByRole('button', { name: 'English' }))
    await userEvent.click(screen.getByRole('button', { name: 'Español' }))

    // Copy re-renders in Spanish and the choice survives a reload.
    expect(screen.getAllByText('Recursos').length).toBeGreaterThan(0)
    expect(localStorage.getItem('wemotes:locale')).toBe('es')
  })

  it('closes the language menu with Escape and returns focus to the trigger', async () => {
    renderFooter()
    const trigger = screen.getByRole('button', { name: 'English' })
    await userEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: 'Español' })).toBeInTheDocument()

    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('button', { name: 'Español' })).not.toBeInTheDocument()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger).toHaveFocus()
  })

  // The accordion is mobile-only (hidden by a media query jsdom doesn't evaluate),
  // so it's selected by testid and clicked with fireEvent.
  it('expands and collapses the mobile menu sections', () => {
    renderFooter()
    const section = screen.getByTestId('footer-section-toggle-getting-started')
    expect(section).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(section)
    expect(section).toHaveAttribute('aria-expanded', 'true')
    const panel = document.getElementById(section.getAttribute('aria-controls')!)
    expect(panel).toHaveAttribute('data-open')

    fireEvent.click(section)
    expect(section).toHaveAttribute('aria-expanded', 'false')
    expect(panel).not.toHaveAttribute('data-open')
  })
})

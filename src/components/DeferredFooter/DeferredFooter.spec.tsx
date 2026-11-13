import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const idle = vi.hoisted(() => ({ value: false }))
vi.mock('~/hooks/useAfterLoadIdle', () => ({ useAfterLoadIdle: () => idle.value }))
vi.mock('~/components/Footer', () => ({ Footer: () => <footer data-testid="footer" /> }))

const { DeferredFooter } = await import('./DeferredFooter')

describe('DeferredFooter', () => {
  it('holds the footer space until the page is idle', () => {
    idle.value = false
    render(<DeferredFooter />)
    expect(screen.getByTestId('footer-placeholder')).toBeInTheDocument()
    expect(screen.queryByTestId('footer')).toBeNull()
  })

  it('renders the footer once the page is idle, without any scrolling', async () => {
    idle.value = true
    render(<DeferredFooter />)
    expect(await screen.findByTestId('footer')).toBeInTheDocument()
    expect(screen.queryByTestId('footer-placeholder')).toBeNull()
  })
})

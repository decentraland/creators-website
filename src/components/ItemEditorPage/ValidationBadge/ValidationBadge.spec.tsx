import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TranslationProvider } from '~/intl'
import { ValidationSeverity } from '~/lib/validation'
import { ValidationBadge, getValidationStatus } from './ValidationBadge'

const warning = {
  code: 'triangle-count',
  severity: ValidationSeverity.WARNING,
  messageKey: 'item_validation.triangle_count_exceeded_with_hint',
  messageParams: { count: 900, limit: 500, category: 'eyewear' }
}
const error = { code: 'skeleton', severity: ValidationSeverity.ERROR, message: 'The skeleton is not the avatar one.' }

describe('ValidationBadge', () => {
  it('derives the traffic light from the issues', () => {
    expect(getValidationStatus(undefined, true)).toBe('loading')
    expect(getValidationStatus(undefined, false)).toBe('idle')
    expect(getValidationStatus([], false)).toBe('pass')
    expect(getValidationStatus([warning], false)).toBe('warnings')
    expect(getValidationStatus([warning, error], false)).toBe('errors')
  })

  it('opens the issue list on click when there is something to show', async () => {
    render(<ValidationBadge status="errors" issues={[warning, error]} />, { wrapper: TranslationProvider })
    expect(screen.getByTestId('validation-badge')).toHaveAttribute('data-status', 'errors')
    await userEvent.click(screen.getByTestId('validation-badge'))
    expect(screen.getByTestId('validation-badge-issues').children).toHaveLength(2)
    expect(screen.getByTestId('validation-badge-issues')).toHaveTextContent(
      'Triangle count (900) exceeds the base limit of 500 for eyewear wearables.'
    )
    expect(screen.getByTestId('validation-badge-issues')).toHaveTextContent('The skeleton is not the avatar one.')
  })

  it('is inert while passing and hidden while idle', () => {
    const { rerender } = render(<ValidationBadge status="pass" issues={[]} />, { wrapper: TranslationProvider })
    expect(screen.getByTestId('validation-badge')).toBeDisabled()
    rerender(<ValidationBadge status="idle" issues={[]} />)
    expect(screen.queryByTestId('validation-badge')).not.toBeInTheDocument()
  })
})

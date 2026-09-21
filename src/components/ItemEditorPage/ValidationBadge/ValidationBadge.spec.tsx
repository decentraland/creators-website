import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TranslationProvider } from '~/intl'
import { ValidationSeverity } from '~/lib/validation'
import { ValidationBadge, getValidationStatus } from './ValidationBadge'

const warning = {
  code: 'W',
  severity: ValidationSeverity.WARNING,
  messageKey: 'item_validation.materials_exceeded',
  messageParams: { count: 3, limit: 2 }
}
const error = { code: 'E', severity: ValidationSeverity.ERROR, messageKey: 'item_validation.cameras_found' }

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
      'Material count (3) exceeds the limit of 2.'
    )
  })

  it('is inert while passing and hidden while idle', () => {
    const { rerender } = render(<ValidationBadge status="pass" issues={[]} />, { wrapper: TranslationProvider })
    expect(screen.getByTestId('validation-badge')).toBeDisabled()
    rerender(<ValidationBadge status="idle" issues={[]} />)
    expect(screen.queryByTestId('validation-badge')).not.toBeInTheDocument()
  })
})

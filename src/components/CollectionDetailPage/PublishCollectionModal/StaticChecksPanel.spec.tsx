import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { TranslationProvider } from '~/intl'
import { type useStaticChecks } from '~/hooks/useStaticChecks'
import { type Item } from '~/lib/items'
import { type StaticChecksResult } from '~/lib/staticChecks'
import { StaticChecksPanel } from './StaticChecksPanel'

const items = [{ id: 'i1', name: 'Pirate Hat', thumbnail: 'thumbnail.png', contents: {} } as Item]

function checks(overrides: Partial<ReturnType<typeof useStaticChecks>>): ReturnType<typeof useStaticChecks> {
  return {
    data: undefined,
    isFetching: false,
    isError: false,
    fetchStatus: 'idle',
    progress: null,
    refetch: vi.fn(),
    ...overrides
  } as unknown as ReturnType<typeof useStaticChecks>
}

function result(findings: StaticChecksResult['items'][number]['findings']): StaticChecksResult {
  const errors = findings.filter(finding => finding.severity === 'error').length
  return {
    items: [{ itemId: 'i1', findings, errors, warnings: findings.length - errors }],
    errors,
    warnings: findings.length - errors,
    durationMs: 10
  }
}

function renderPanel(subject: ReturnType<typeof useStaticChecks>) {
  render(
    <TranslationProvider>
      <StaticChecksPanel checks={subject} items={items} />
    </TranslationProvider>
  )
}

describe('StaticChecksPanel', () => {
  it('shows progress while the checks run', () => {
    renderPanel(checks({ isFetching: true, fetchStatus: 'fetching', progress: { done: 1, total: 3, itemId: 'i1' } }))
    expect(screen.getByTestId('static-checks')).toHaveAttribute('data-state', 'checking')
    expect(screen.getByTestId('static-checks')).toHaveTextContent('1 of 3')
  })

  it('lists the blocking findings with their fix and keeps warnings behind a toggle', () => {
    renderPanel(
      checks({
        data: result([
          {
            check: 'triangle-count',
            rule: 'M-01',
            severity: 'error',
            message: 'Too many triangles',
            fix: 'Decimate the mesh'
          },
          { check: 'texture-size', rule: 'M-04', severity: 'warning', message: 'Large texture' }
        ])
      })
    )
    expect(screen.getByTestId('static-checks')).toHaveAttribute('data-state', 'errors')
    expect(screen.getByTestId('static-checks-errors-i1-finding')).toHaveTextContent('Decimate the mesh')
    expect(screen.queryByTestId('static-checks-warnings')).toBeNull()
    fireEvent.click(screen.getByTestId('static-checks-toggle-warnings'))
    expect(screen.getByTestId('static-checks-warnings-i1-finding')).toHaveTextContent('M-04')
  })

  it('passes with warnings only, and offers a retry when the checker itself failed', () => {
    const { unmount } = render(
      <TranslationProvider>
        <StaticChecksPanel
          checks={checks({ data: result([{ check: 'x', rule: 'M-04', severity: 'warning', message: 'Large' }]) })}
          items={items}
        />
      </TranslationProvider>
    )
    expect(screen.getByTestId('static-checks')).toHaveAttribute('data-state', 'warnings')
    unmount()

    const refetch = vi.fn()
    renderPanel(checks({ isError: true, refetch }))
    fireEvent.click(screen.getByTestId('static-checks-retry'))
    expect(refetch).toHaveBeenCalled()
  })
})

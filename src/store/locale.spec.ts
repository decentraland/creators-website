import { describe, it, expect, afterEach } from 'vitest'
import { getPreferredLocale, useLocale } from './locale'

describe('locale store', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('defaults to en when nothing is saved', () => {
    expect(getPreferredLocale()).toBe('en')
  })

  it('persists the chosen locale and exposes it as state', () => {
    useLocale.getState().setLocale('es')
    expect(useLocale.getState().locale).toBe('es')
    expect(localStorage.getItem('creators:locale')).toBe('es')
    expect(getPreferredLocale()).toBe('es')
  })

  it('ignores an invalid saved value', () => {
    localStorage.setItem('creators:locale', 'fr')
    expect(getPreferredLocale()).toBe('en')
  })
})

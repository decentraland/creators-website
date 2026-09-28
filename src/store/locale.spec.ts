import { describe, it, expect, afterEach, vi } from 'vitest'
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

  it('picks up a supported browser language when nothing is saved', () => {
    const language = vi.spyOn(navigator, 'language', 'get').mockReturnValue('zh-CN')
    expect(getPreferredLocale()).toBe('zh')
    language.mockRestore()
  })

  it('ignores an invalid saved value', () => {
    localStorage.setItem('creators:locale', 'fr')
    expect(getPreferredLocale()).toBe('en')
  })
})

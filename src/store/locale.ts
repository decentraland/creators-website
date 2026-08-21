import { create } from 'zustand'

const KEY = 'wemotes:locale'

export const LOCALES = ['en', 'es'] as const

export type Locale = (typeof LOCALES)[number]

// Initial locale: saved choice → browser language → English.
export const getPreferredLocale = (): Locale => {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved && (LOCALES as readonly string[]).includes(saved)) return saved as Locale
  } catch {
    // restricted storage → fall through to browser language
  }
  return navigator.language?.toLowerCase().startsWith('es') ? 'es' : 'en'
}

type LocaleState = {
  locale: Locale
  setLocale: (locale: Locale) => void
}

export const useLocale = create<LocaleState>(set => ({
  locale: getPreferredLocale(),
  setLocale: locale => {
    try {
      localStorage.setItem(KEY, locale)
    } catch {
      // ignore — the choice just won't survive a reload
    }
    set({ locale })
  }
}))

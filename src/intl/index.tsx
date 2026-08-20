import { ReactNode } from 'react'
import { IntlProvider, useIntl } from 'react-intl'
import en from './en.json'
import es from './es.json'

type Locale = 'en' | 'es'

const messages: Record<Locale, Record<string, string>> = { en, es }

const getPreferredLocale = (): Locale => (navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en')

const locale = getPreferredLocale()

const TranslationProvider = ({ children }: { children: ReactNode }) => {
  return (
    <IntlProvider locale={locale} defaultLocale="en" messages={messages[locale]}>
      {children}
    </IntlProvider>
  )
}

const useTranslation = () => {
  const intl = useIntl()
  return {
    t: (id: string, values?: Record<string, string | number>) => intl.formatMessage({ id }, values)
  }
}

export { TranslationProvider, useTranslation }

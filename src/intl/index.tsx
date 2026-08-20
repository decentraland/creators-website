import { ReactNode } from 'react'
import { IntlProvider, useIntl } from 'react-intl'
import { useLocale, type Locale } from '~/store/locale'
import en from './en.json'
import es from './es.json'

const messages: Record<Locale, Record<string, string>> = { en, es }

const TranslationProvider = ({ children }: { children: ReactNode }) => {
  const locale = useLocale(s => s.locale)
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

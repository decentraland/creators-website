import { ReactNode, useCallback } from 'react'
import { IntlProvider, useIntl } from 'react-intl'
import { useLocale, type Locale } from '~/store/locale'
import { flattenMessages } from '~/lib/messages'
import en from './en.json'
import es from './es.json'

const messages: Record<Locale, Record<string, string>> = {
  en: flattenMessages(en),
  es: flattenMessages(es)
}

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
  // Stable across renders so `t` can sit in hook dependency arrays without defeating them.
  const t = useCallback(
    (id: string, values?: Record<string, string | number>) => intl.formatMessage({ id }, values),
    [intl]
  )
  return { t }
}

export { TranslationProvider, useTranslation }

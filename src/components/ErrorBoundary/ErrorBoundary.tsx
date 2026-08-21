import { Component, type ReactNode } from 'react'
import { useTranslation } from '~/intl'
import * as S from './ErrorBoundary.styles'

type Props = { children: ReactNode }
type State = { hasError: boolean }

/** Catches render and chunk-load errors below it (e.g. a stale deploy) and offers a reload. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  render() {
    return this.state.hasError ? <ErrorFallback /> : this.props.children
  }
}

// React.lazy caches a failed chunk import, so recovery is a full reload rather than a re-render.
function ErrorFallback() {
  const { t } = useTranslation()
  return (
    <S.Panel data-testid="error-boundary">
      <S.Title>{t('error_boundary.title')}</S.Title>
      <S.Text>{t('error_boundary.description')}</S.Text>
      <S.RetryButton type="button" data-testid="error-boundary-retry" onClick={() => window.location.reload()}>
        {t('error_boundary.retry')}
      </S.RetryButton>
    </S.Panel>
  )
}

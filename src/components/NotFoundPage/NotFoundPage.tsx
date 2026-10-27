import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '~/components/Button'
import { useTranslation } from '~/intl'
import { track } from '~/lib/analytics'
import * as S from './NotFoundPage.styles'

const NotFoundPage = () => {
  const { t } = useTranslation()
  useEffect(() => {
    track('Not found page')
  }, [])
  return (
    <S.Panel data-testid="not-found-page">
      <S.Title>{t('not_found_page.title')}</S.Title>
      <S.Text>{t('not_found_page.description')}</S.Text>
      <Button as={Link} to="/" data-testid="not-found-home">
        {t('not_found_page.go_home')}
      </Button>
    </S.Panel>
  )
}

export { NotFoundPage }

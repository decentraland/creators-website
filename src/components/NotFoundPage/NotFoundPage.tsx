import { useEffect } from 'react'
import { Box, Link, Typography } from 'decentraland-ui2'
import { Link as RouterLink } from 'react-router-dom'
import { useTranslation } from '~/intl'
import { track } from '~/lib/analytics'

const NotFoundPage = () => {
  const { t } = useTranslation()
  useEffect(() => {
    track('Not found page')
  }, [])
  return (
    <Box data-testid="not-found-page">
      <Typography variant="h4">{t('not_found_page.title')}</Typography>
      <Link component={RouterLink} to="/">
        {t('not_found_page.go_home')}
      </Link>
    </Box>
  )
}

export { NotFoundPage }

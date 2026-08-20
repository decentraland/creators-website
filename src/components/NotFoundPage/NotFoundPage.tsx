import { Box, Link, Typography } from 'decentraland-ui2'
import { Link as RouterLink } from 'react-router-dom'
import { useTranslation } from '~/intl'

const NotFoundPage = () => {
  const { t } = useTranslation()
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

import { Box, Typography } from 'decentraland-ui2'
import { useTranslation } from '~/intl'

const OverviewPage = () => {
  const { t } = useTranslation()
  return (
    <Box data-testid="overview-page">
      <Typography variant="h4">{t('overview_page.title')}</Typography>
    </Box>
  )
}

export { OverviewPage }

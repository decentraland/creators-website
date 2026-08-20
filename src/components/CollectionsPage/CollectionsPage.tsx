import { Box, Typography } from 'decentraland-ui2'
import { useTranslation } from '~/intl'

const CollectionsPage = () => {
  const { t } = useTranslation()
  return (
    <Box data-testid="collections-page">
      <Typography variant="h4">{t('collections_page.title')}</Typography>
    </Box>
  )
}

export { CollectionsPage }

import { Box, Typography } from 'decentraland-ui2'
import { useTranslation } from '~/intl'

const CurationPage = () => {
  const { t } = useTranslation()
  return (
    <Box data-testid="curation-page">
      <Typography variant="h4">{t('curation_page.title')}</Typography>
    </Box>
  )
}

export { CurationPage }

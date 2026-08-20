import { Box, Typography } from 'decentraland-ui2'
import { useParams } from 'react-router-dom'
import { useTranslation } from '~/intl'

const CollectionDetailPage = () => {
  const { t } = useTranslation()
  const { collectionId } = useParams()
  return (
    <Box data-testid="collection-detail-page">
      <Typography variant="h4">{t('collection_detail_page.title')}</Typography>
      <Typography variant="body1">{collectionId}</Typography>
    </Box>
  )
}

export { CollectionDetailPage }

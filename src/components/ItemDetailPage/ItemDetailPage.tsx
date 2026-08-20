import { Box, Typography } from 'decentraland-ui2'
import { useParams } from 'react-router-dom'
import { useTranslation } from '~/intl'

const ItemDetailPage = () => {
  const { t } = useTranslation()
  const { itemId } = useParams()
  return (
    <Box data-testid="item-detail-page">
      <Typography variant="h4">{t('item_detail_page.title')}</Typography>
      <Typography variant="body1">{itemId}</Typography>
    </Box>
  )
}

export { ItemDetailPage }

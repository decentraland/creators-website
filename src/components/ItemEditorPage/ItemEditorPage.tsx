import { Box, Typography } from 'decentraland-ui2'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from '~/intl'

const ItemEditorPage = () => {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const collectionId = searchParams.get('collection')
  const itemId = searchParams.get('item')
  return (
    <Box data-testid="item-editor-page">
      <Typography variant="h4">{t('item_editor_page.title')}</Typography>
      <Typography variant="body1">
        {collectionId} / {itemId}
      </Typography>
    </Box>
  )
}

export { ItemEditorPage }

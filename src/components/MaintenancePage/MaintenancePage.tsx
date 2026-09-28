import { useTranslation } from '~/intl'
import { Panel, PanelText, PanelTitle } from '~/styles/shared'

/** Shown in place of every route while the `maintenance` flag is on. */
const MaintenancePage = () => {
  const { t } = useTranslation()
  return (
    <Panel data-testid="maintenance-page">
      <PanelTitle>{t('maintenance_page.title')}</PanelTitle>
      <PanelText>{t('maintenance_page.description')}</PanelText>
    </Panel>
  )
}

export { MaintenancePage }

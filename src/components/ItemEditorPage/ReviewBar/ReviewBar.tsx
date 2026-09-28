import { useTranslation } from '~/intl'
import * as S from '../ItemEditorPage.styles'

/** Curation actions mount here once the curation feature lands; until then the bar only names the mode. */
export function ReviewBar() {
  const { t } = useTranslation()
  return (
    <S.ReviewBar role="toolbar" aria-label={t('item_editor.review.title')} data-testid="review-bar">
      <span>{t('item_editor.review.title')}</span>
    </S.ReviewBar>
  )
}

import { ForumOutlined as ForumIcon, OpenInNew as OpenInNewIcon } from '@mui/icons-material'
import { Button } from '~/components/Button'
import { Modal } from '~/components/Modal'
import { useTranslation } from '~/intl'
import { track } from '~/lib/analytics'
import { type Collection } from '~/lib/collections'
import * as S from './ForumVerdictModal.styles'

type Props = {
  collection: Collection & { forumLink: string }
  onClose: () => void
}

/** After a rejection or a disable: the creator learns why on the collection's forum post. */
export function ForumVerdictModal({ collection, onClose }: Props) {
  const { t } = useTranslation()
  const title = t('item_editor.review.verdict.title')
  return (
    <Modal title={title} onClose={onClose} hideTitle testId="review-verdict">
      <S.Wrap>
        <S.Icon aria-hidden>
          <ForumIcon />
        </S.Icon>
        <S.Heading>{title}</S.Heading>
        <S.Text>{t('item_editor.review.verdict.body', { collection: collection.name })}</S.Text>
        <S.Actions>
          <Button type="button" variant="secondary" data-testid="review-verdict-done" onClick={onClose}>
            {t('item_editor.review.verdict.done')}
          </Button>
          <Button
            as="a"
            href={collection.forumLink}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="review-verdict-forum-link"
            onClick={() => track('Forum post opened', { collectionId: collection.id, surface: 'review_verdict' })}
          >
            {t('item_editor.review.verdict.open_forum')}
            <OpenInNewIcon fontSize="small" aria-hidden />
          </Button>
        </S.Actions>
      </S.Wrap>
    </Modal>
  )
}

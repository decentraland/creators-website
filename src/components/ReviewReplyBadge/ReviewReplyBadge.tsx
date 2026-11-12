import { useMemo } from 'react'
import { useTranslation } from '~/intl'
import { useRecentCollectionEvents } from '~/hooks/useCollectionEvents'
import { CollectionDisplayStatus, getCollectionDisplayStatus, type Collection } from '~/lib/collections'
import { getAwaitedReply } from '~/lib/events'
import * as S from './ReviewReplyBadge.styles'

/** Collections whose review is still open: the only ones worth a timeline request per list row. */
const IN_REVIEW: CollectionDisplayStatus[] = [CollectionDisplayStatus.UNDER_REVIEW, CollectionDisplayStatus.REJECTED]

type Props = { collection: Collection; address: string | undefined; className?: string }

/** Marks a collection in the creator's lists when a curator's comment is waiting for an answer. */
export function ReviewReplyBadge({ collection, address, className }: Props) {
  const { t } = useTranslation()
  const inReview = IN_REVIEW.includes(getCollectionDisplayStatus(collection))
  const recent = useRecentCollectionEvents(address, collection.id, inReview)
  const awaited = useMemo(() => !!recent.data && getAwaitedReply(recent.data) === 'creator', [recent.data])
  if (!awaited) return null
  return (
    <S.Badge className={className} data-testid="review-reply-badge">
      {t('review_flow.curator_replied')}
    </S.Badge>
  )
}

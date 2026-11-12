import { useMemo } from 'react'
import { useIntl } from 'react-intl'
import { Edit as EditIcon } from '@mui/icons-material'
import { useTranslation } from '~/intl'
import { CollectionMosaic } from '~/components/CollectionMosaic'
import { CurationStatePill } from '~/components/CurationStatePill'
import { ReviewTypePill } from '../ReviewTypePill'
import { ProfileBadge } from '~/components/ProfileBadge'
import { AutomatedReviewIcon } from '~/components/AutomatedReviewIcon'
import { Tooltip } from '~/components/Tooltip'
import { useRecentCollectionEvents } from '~/hooks/useCollectionEvents'
import { getAwaitedReply, getCuratorVerdict, type CollectionEvent } from '~/lib/events'
import { isLinkedCollection, type Collection } from '~/lib/collections'
import { openForumPost } from '~/lib/forumPost'
import {
  canEditAssignee,
  getReviewStage,
  getReviewType,
  type CollectionCuration,
  getCuratorState,
  ReviewStage,
  VALIDATOR_REVIEWER
} from '~/lib/curation'
import { formatTimeAgo } from '~/lib/time'
import * as S from './CurationRow.styles'

type Props = {
  collection: Collection
  curation: CollectionCuration | null
  address: string
  onAssign: (collection: Collection, curation: CollectionCuration | null, mode: 'self' | 'edit') => void
}

const NO_EVENTS: CollectionEvent[] = []

function reviewUrl(collection: Collection): string {
  return `/collections/editor?collection=${collection.id}&reviewing=true`
}

export function CurationRow({ collection, curation, address, onAssign }: Props) {
  const { t } = useTranslation()
  const intl = useIntl()
  // Only a pending request needs the timeline to tell its step. A decided one carries its reviewer, which
  // only a server with the timeline writes, so its stage needs no request per row.
  const pending = curation?.status === 'pending'
  // A curator's request for fixes is the other case with a conversation: the creator may answer it in writing.
  const fixesRequested =
    curation?.status === 'rejected' && !!curation.reviewedBy && curation.reviewedBy !== VALIDATOR_REVIEWER
  const recent = useRecentCollectionEvents(address, collection.id, pending || fixesRequested)
  const events = pending ? (recent.data ?? null) : recent.flagEnabled && curation?.reviewedBy ? NO_EVENTS : null
  const stage = useMemo(() => getReviewStage(collection, curation, events), [collection, curation, events])
  const curatorState = getCuratorState(collection, curation, stage)
  // Only the current request's result says why it is in the queue; an older run belongs to another request.
  const verdict = useMemo(() => {
    const latest = events ? getCuratorVerdict(events) : null
    return latest && curation && latest.createdAt >= curation.createdAt ? latest : null
  }, [events, curation])
  const automatedStatus =
    stage === ReviewStage.REJECTED_BY_VALIDATOR ? 'rejected' : pending && verdict ? verdict.outcome : null
  const creatorReplied = useMemo(() => !!recent.data && getAwaitedReply(recent.data) === 'curator', [recent.data])
  const assignee = curation?.assignee ?? null
  const canAssign = canEditAssignee(collection, curation)

  return (
    <S.Row data-testid="curation-row" data-state={curatorState} data-stage={stage ?? undefined}>
      <S.NameCell>
        <S.Thumb>
          <CollectionMosaic collectionId={collection.id} itemCount={collection.itemCount} />
        </S.Thumb>
        <S.RowLink to={reviewUrl(collection)} data-testid="curation-row-link">
          <S.Name title={collection.name}>{collection.name}</S.Name>
          <S.Sub>
            {t('collections_page.item_count', { count: collection.itemCount })}
            {isLinkedCollection(collection) && ` · ${t('collection_status.linked')}`}
          </S.Sub>
        </S.RowLink>
      </S.NameCell>
      <S.Cell data-cell="owner">
        {collection.owner ? (
          <ProfileBadge address={collection.owner} testId="curation-row-owner" />
        ) : (
          // Linked collections belong to a third party, not a wallet.
          <S.Unassigned data-testid="curation-row-owner">{t('curation_page.list.third_party')}</S.Unassigned>
        )}
      </S.Cell>
      <S.Cell data-cell="requested" data-testid="curation-row-requested">
        <S.CellLabel>{t(curation ? 'curation_page.list.requested' : 'curation_page.list.created')}</S.CellLabel>
        {formatTimeAgo(curation?.createdAt ?? collection.createdAt, intl.locale)}
      </S.Cell>
      <S.Pills>
        <S.Cell data-cell="type">
          <ReviewTypePill type={getReviewType(collection)} />
        </S.Cell>
        <S.Cell data-cell="state">
          <S.StateWithReview>
            <CurationStatePill state={curatorState} />
            {automatedStatus && (
              <Tooltip
                content={[
                  t(`automated_verdict.status_${automatedStatus}`),
                  stage === ReviewStage.APPEALED && t('automated_verdict.reason_requested')
                ]
                  .filter(Boolean)
                  .join('\n')}
                testId="curation-row-automated"
              >
                <AutomatedReviewIcon status={automatedStatus} />
              </Tooltip>
            )}
          </S.StateWithReview>
        </S.Cell>
      </S.Pills>
      <S.DiscussionCell data-testid="curation-row-discussion">
        <S.CellLabel data-mobile-only>{t('curation_page.list.discussion')}</S.CellLabel>
        {creatorReplied && (
          <S.Replied data-testid="curation-row-replied">{t('curation_page.list.creator_replied')}</S.Replied>
        )}
        {collection.forumLink ? (
          <S.ForumLink
            type="button"
            data-testid="curation-row-forum-link"
            onClick={() => openForumPost(collection, 'curation_list')}
          >
            {t('curation_page.list.forum_post')}
          </S.ForumLink>
        ) : (
          <S.Unassigned>{t('curation_page.list.not_posted')}</S.Unassigned>
        )}
      </S.DiscussionCell>
      <S.AssigneeCell data-testid="curation-row-assignee" data-unassigned={assignee ? undefined : ''}>
        {assignee ? (
          <>
            <ProfileBadge address={assignee} self={assignee === address.toLowerCase()} testId="curation-row-curator" />
            {canAssign && (
              <S.IconAction
                type="button"
                aria-label={t('curation_page.list.edit_assignee')}
                data-testid="curation-row-edit-assignee"
                onClick={() => onAssign(collection, curation, 'edit')}
              >
                <EditIcon fontSize="small" />
              </S.IconAction>
            )}
          </>
        ) : (
          <>
            <S.Unassigned>{t('curation_page.list.unassigned')}</S.Unassigned>
            {canAssign && (
              <S.TextAction
                type="button"
                data-testid="curation-row-assign-me"
                onClick={() => onAssign(collection, curation, 'self')}
              >
                {t('curation_page.list.assign_to_me')}
              </S.TextAction>
            )}
          </>
        )}
      </S.AssigneeCell>
    </S.Row>
  )
}

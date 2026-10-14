import { useMemo } from 'react'
import { useIntl } from 'react-intl'
import { Edit as EditIcon } from '@mui/icons-material'
import { useTranslation } from '~/intl'
import { CollectionMosaic } from '~/components/CollectionMosaic'
import { CurationStatePill } from '~/components/CurationStatePill'
import { ReviewTypePill } from '../ReviewTypePill'
import { ProfileBadge } from '~/components/ProfileBadge'
import { ReviewStagePill } from '~/components/ReviewStagePill'
import { useRecentCollectionEvents } from '~/hooks/useCollectionEvents'
import { isLinkedCollection, type Collection } from '~/lib/collections'
import { openForumPost } from '~/lib/forumPost'
import {
  canEditAssignee,
  getCurationState,
  getReviewStage,
  getReviewType,
  type CollectionCuration
} from '~/lib/curation'
import { formatTimeAgo } from '~/lib/time'
import * as S from './CurationRow.styles'

type Props = {
  collection: Collection
  curation: CollectionCuration | null
  address: string
  onAssign: (collection: Collection, curation: CollectionCuration | null, mode: 'self' | 'edit') => void
}

function reviewUrl(collection: Collection): string {
  return `/collections/editor?collection=${collection.id}&reviewing=true`
}

export function CurationRow({ collection, curation, address, onAssign }: Props) {
  const { t } = useTranslation()
  const intl = useIntl()
  const state = getCurationState(collection, curation)
  // A stage needs the timeline (pending: which step; decided: that the server has one at all).
  const recent = useRecentCollectionEvents(address, collection.id, !!curation)
  const events = recent.data ?? null
  const stage = useMemo(() => getReviewStage(collection, curation, events), [collection, curation, events])
  const assignee = curation?.assignee ?? null
  const canAssign = canEditAssignee(collection, curation)

  return (
    <S.Row data-testid="curation-row" data-state={state} data-stage={stage ?? undefined}>
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
          {stage ? <ReviewStagePill stage={stage} /> : <CurationStatePill state={state} />}
        </S.Cell>
      </S.Pills>
      <S.DiscussionCell data-testid="curation-row-discussion">
        <S.CellLabel data-mobile-only>{t('curation_page.list.discussion')}</S.CellLabel>
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

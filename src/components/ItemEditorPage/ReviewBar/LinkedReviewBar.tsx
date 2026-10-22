import { useState } from 'react'
import { useIntl } from 'react-intl'
import { ArrowBack as ArrowBackIcon, Edit as EditIcon, PersonAddAlt as AssignIcon } from '@mui/icons-material'
import { useTranslation } from '~/intl'
import { AssignCuratorModal } from '~/components/AssignCuratorModal'
import { Button } from '~/components/Button'
import { CollectionStatusPill } from '~/components/CollectionStatusPill'
import { ConfirmModal } from '~/components/ConfirmModal'
import { ProfileBadge } from '~/components/ProfileBadge'
import { Tooltip } from '~/components/Tooltip'
import { useCollectionCuration } from '~/hooks/useCuration'
import { useItemCurations } from '~/hooks/useLinkedCollection'
import { usePendingLinkedItems, useRejectLinkedItems, useReviewedItems } from '~/hooks/useLinkedReview'
import { getReviewThreshold } from '~/lib/approveLinkedCollection'
import { type Session } from '~/lib/auth'
import { type Collection } from '~/lib/collections'
import { curationListUrl } from '~/lib/curation'
import { type Item } from '~/lib/items'
import { type ItemCuration } from '~/lib/linkedItemStatus'
import { useNotifications } from '~/lib/notifications'
import { type ThirdParty } from '~/lib/thirdParty'
import { formatTimeAgo } from '~/lib/time'
import { ForumVerdictModal } from './ForumVerdictModal'
import { LinkedApprovalFlowModal } from './LinkedApprovalFlowModal'
import { ThirdPartyStatusFlow } from './ThirdPartyStatusFlow'
import * as S from './ReviewBar.styles'

type Props = {
  session: Session
  collection: Collection
  thirdParty: ThirdParty
  selectedId: string | null
  onSelectItem: (item: Item) => void
}

type Dialog = 'assign' | 'reject' | 'approve' | 'disable' | 'enable' | null

/**
 * The curator's toolbar over a linked collection: the items waiting for review, how many were opened against the
 * review threshold, and the committee's actions (approve, reject, enable or disable the third party).
 */
export function LinkedReviewBar({ session, collection, thirdParty, selectedId, onSelectItem }: Props) {
  const { t } = useTranslation()
  const intl = useIntl()
  const address = session.address
  const showToast = useNotifications(state => state.showToast)
  const curationQuery = useCollectionCuration(address, collection)
  const curation = curationQuery.data ?? null
  const pending = usePendingLinkedItems(address, collection)
  const curations = useItemCurations(address, collection)
  const reject = useRejectLinkedItems(address, collection)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [verdict, setVerdict] = useState(false)

  const pendingItems = pending.data ?? []
  const { reviewedCount, nextToReview, review } = useReviewedItems(pendingItems, selectedId)
  const threshold = getReviewThreshold(pendingItems.length)
  const canApprove = pendingItems.length > 0 && reviewedCount >= threshold
  const assignee = curation?.assignee ?? null
  const isLoading = pending.isLoading || curations.isLoading
  const [timeKey, time] = !curation
    ? ['created', collection.createdAt]
    : curation.status === 'pending'
      ? ['requested', curation.createdAt]
      : [curation.status, curation.updatedAt]

  const closeDialog = () => {
    setDialog(null)
    reject.reset()
  }

  function reviewNext() {
    const item = nextToReview()
    if (item) onSelectItem(item)
  }

  return (
    <S.ReviewBar role="toolbar" aria-label={t('item_editor.review.title')} data-testid="review-bar">
      <S.Identity>
        <S.BackLink to={curationListUrl()} aria-label={t('item_editor.review.back')} data-testid="review-back">
          <ArrowBackIcon fontSize="small" />
        </S.BackLink>
        <S.Name title={collection.name}>{collection.name}</S.Name>
        <CollectionStatusPill collection={collection} />
      </S.Identity>

      <S.Meta>
        {!isLoading && (
          <span data-testid="review-linked-progress">
            {pendingItems.length === 0
              ? t('item_editor.linked_review.nothing_pending')
              : t('item_editor.linked_review.reviewed', { count: reviewedCount, threshold })}
          </span>
        )}
        {curation && (
          <span data-testid="review-requested">
            {t(`item_editor.review.${timeKey}`, { time: formatTimeAgo(time, intl.locale) })}
          </span>
        )}
        {assignee ? (
          <S.AssigneeChip
            type="button"
            aria-label={t('item_editor.review.change_assignee')}
            data-testid="review-assignee"
            onClick={() => setDialog('assign')}
          >
            <ProfileBadge address={assignee} self={assignee === address.toLowerCase()} />
            <EditIcon fontSize="inherit" />
          </S.AssigneeChip>
        ) : (
          curation && (
            <S.AssigneeChip type="button" data-testid="review-assign-me" onClick={() => setDialog('assign')}>
              <AssignIcon fontSize="small" />
              {t('item_editor.review.assign_to_me')}
            </S.AssigneeChip>
          )
        )}
      </S.Meta>

      <S.Actions>
        {pendingItems.length > reviewedCount && (
          <Button type="button" size="sm" variant="dark" data-testid="review-linked-next" onClick={reviewNext}>
            {t('item_editor.linked_review.review_next')}
          </Button>
        )}
        {pendingItems.length > 0 && (
          <>
            <Tooltip
              content={canApprove ? null : t('item_editor.linked_review.approve_blocked', { threshold })}
              asChild
              testId="review-linked-approve-tooltip"
            >
              <Button
                type="button"
                size="sm"
                variant="primary"
                aria-disabled={!canApprove || undefined}
                data-testid="review-action-approve"
                onClick={() => canApprove && setDialog('approve')}
              >
                {t('item_editor.review.action.approve')}
              </Button>
            </Tooltip>
            <Button
              type="button"
              size="sm"
              variant="dark"
              data-testid="review-action-reject"
              onClick={() => setDialog('reject')}
            >
              {t('item_editor.review.action.reject')}
            </Button>
          </>
        )}
        {thirdParty.published &&
          (thirdParty.isApproved ? (
            <Button
              type="button"
              size="sm"
              variant="dark"
              data-testid="review-action-disable"
              onClick={() => setDialog('disable')}
            >
              {t('item_editor.linked_review.disable_third_party')}
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="primary"
              data-testid="review-action-enable"
              onClick={() => setDialog('enable')}
            >
              {t('item_editor.linked_review.enable_third_party')}
            </Button>
          ))}
      </S.Actions>

      {dialog === 'assign' && (
        <AssignCuratorModal
          collection={collection}
          curation={curation}
          address={address}
          mode={assignee ? 'edit' : 'self'}
          onClose={closeDialog}
        />
      )}
      {dialog === 'reject' && (
        <ConfirmModal
          title={t('item_editor.review.reject.title', { collection: collection.name })}
          description={t('item_editor.linked_review.reject_description', { count: pendingItems.length })}
          error={reject.isError ? t('item_editor.review.reject.error') : null}
          busy={reject.isPending}
          onClose={closeDialog}
          cancel={{ label: t('item_editor.review.cancel'), onClick: closeDialog, testId: 'review-reject-cancel' }}
          confirm={{
            label: t('item_editor.review.reject.confirm'),
            testId: 'review-reject-confirm',
            onClick: () =>
              reject.mutate(
                { items: pendingItems, curations: curations.data ?? new Map<string, ItemCuration>() },
                {
                  onSuccess: () => {
                    showToast(t('item_editor.review.reject.success', { collection: collection.name }))
                    closeDialog()
                    if (collection.forumLink) setVerdict(true)
                  }
                }
              )
          }}
          testId="review-reject"
        />
      )}
      {(dialog === 'disable' || dialog === 'enable') && (
        <ThirdPartyStatusFlow
          session={session}
          thirdParty={thirdParty}
          approved={dialog === 'enable'}
          onClose={closeDialog}
          onDone={() => {
            if (dialog === 'disable' && collection.forumLink) setVerdict(true)
          }}
        />
      )}
      {verdict && collection.forumLink && (
        <ForumVerdictModal
          collection={{ ...collection, forumLink: collection.forumLink }}
          onClose={() => setVerdict(false)}
        />
      )}
      {dialog === 'approve' && (
        <LinkedApprovalFlowModal
          session={session}
          collection={collection}
          thirdParty={thirdParty}
          review={review}
          onClose={closeDialog}
        />
      )}
    </S.ReviewBar>
  )
}

import { useMemo, useState } from 'react'
import { useIntl } from 'react-intl'
import { ArrowBack as ArrowBackIcon, Edit as EditIcon, PersonAddAlt as AssignIcon } from '@mui/icons-material'
import { useTranslation } from '~/intl'
import { AssignCuratorModal } from '~/components/AssignCuratorModal'
import { Button } from '~/components/Button'
import { ConfirmModal } from '~/components/ConfirmModal'
import { CurationStatePill } from '~/components/CurationStatePill'
import { ProfileBadge } from '~/components/ProfileBadge'
import { useCollectionCuration, useRejectCuration } from '~/hooks/useCuration'
import { useItemSyncs } from '~/hooks/useItemSync'
import { type ApprovalMode } from '~/hooks/useApprovalFlow'
import { type Session } from '~/lib/auth'
import { type Collection } from '~/lib/collections'
import { ReviewAction, canEditAssignee, curationListUrl, getCurationState, getReviewActions } from '~/lib/curation'
import { ItemSyncStatus } from '~/lib/itemSync'
import { type Item } from '~/lib/items'
import { useNotifications } from '~/lib/notifications'
import { formatTimeAgo } from '~/lib/time'
import { ApprovalFlowModal } from './ApprovalFlowModal'
import { DisableCollectionFlow } from './DisableCollectionFlow'
import { ForumVerdictModal } from './ForumVerdictModal'
import * as S from './ReviewBar.styles'

type Props = {
  session: Session
  collection: Collection
  items: Item[]
}

type Dialog = 'assign' | 'reject' | 'disable' | null

const DECISIONS = [ReviewAction.APPROVE, ReviewAction.ENABLE, ReviewAction.REJECT]

/** The curator's toolbar over the read-only editor: the collection's review state and the committee's actions. */
export function ReviewBar({ session, collection, items }: Props) {
  const { t } = useTranslation()
  const intl = useIntl()
  const address = session.address
  const showToast = useNotifications(state => state.showToast)
  const curationQuery = useCollectionCuration(address, collection)
  const curation = curationQuery.data ?? null
  const syncs = useItemSyncs(address, collection, items)
  const reject = useRejectCuration(address)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [approval, setApproval] = useState<ApprovalMode | null>(null)
  // The curator about to decide is assigned first, so the request always names who curated the collection.
  const [takeOver, setTakeOver] = useState<ReviewAction | null>(null)
  const [verdict, setVerdict] = useState(false)
  const self = address.toLowerCase()

  const hasMissingEntities = useMemo(
    () => [...syncs.values()].some(sync => sync.status === ItemSyncStatus.UNSYNCED && !sync.entity),
    [syncs]
  )
  const state = getCurationState(collection, curation)
  const actions = collection.isPublished ? getReviewActions(collection, curation, hasMissingEntities) : []
  const assignee = curation?.assignee ?? null
  // A first-review rejection opens the request itself, so its creation time only means something while pending.
  const [timeKey, time] = !curation
    ? ['created', collection.createdAt]
    : curation.status === 'pending'
      ? ['requested', curation.createdAt]
      : [curation.status, curation.updatedAt]
  const canAssign = canEditAssignee(collection, curation)
  const isLoading = collection.isPublished && curationQuery.isLoading
  // Without the request, Reject and Assign would open a new one instead of updating it.
  const isCurationError = collection.isPublished && curationQuery.isError && !curationQuery.data

  function onAction(action: ReviewAction) {
    // Enable never opens a request (it only switches the collection back on): with none, there is nothing to take
    // over; with one, taking it over only records who enabled it.
    const nothingToTake = action === ReviewAction.ENABLE && !curation
    if (DECISIONS.includes(action) && curation?.assignee !== self && !nothingToTake) return setTakeOver(action)
    runAction(action)
  }

  function runAction(action: ReviewAction) {
    if (action === ReviewAction.APPROVE) setApproval('approve')
    else if (action === ReviewAction.ENABLE) setApproval('enable')
    else if (action === ReviewAction.DEPLOY_MISSING) setApproval('deploy_missing')
    else if (action === ReviewAction.REJECT) setDialog('reject')
    else setDialog('disable')
  }

  const closeDialog = () => {
    setDialog(null)
    reject.reset()
  }

  return (
    <S.ReviewBar role="toolbar" aria-label={t('item_editor.review.title')} data-testid="review-bar">
      <S.Identity>
        <S.BackLink to={curationListUrl()} aria-label={t('item_editor.review.back')} data-testid="review-back">
          <ArrowBackIcon fontSize="small" />
        </S.BackLink>
        <S.Name title={collection.name}>{collection.name}</S.Name>
        {!isLoading && !isCurationError && <CurationStatePill state={state} />}
      </S.Identity>

      <S.Meta>
        {!collection.isPublished ? (
          <span data-testid="review-unpublished">{t('item_editor.review.unpublished')}</span>
        ) : isLoading ? null : isCurationError ? (
          <>
            <span data-testid="review-curation-error">{t('item_editor.review.curation_error')}</span>
            <Button
              type="button"
              size="sm"
              variant="dark"
              data-testid="review-curation-retry"
              onClick={() => void curationQuery.refetch()}
            >
              {t('item_editor.review.retry')}
            </Button>
          </>
        ) : (
          <>
            <span data-testid="review-requested">
              {t(`item_editor.review.${timeKey}`, { time: formatTimeAgo(time, intl.locale) })}
            </span>
            {assignee ? (
              <S.AssigneeChip
                type="button"
                disabled={!canAssign}
                aria-label={t('item_editor.review.change_assignee')}
                data-testid="review-assignee"
                onClick={() => setDialog('assign')}
              >
                <ProfileBadge address={assignee} self={assignee === address.toLowerCase()} />
                {canAssign && <EditIcon fontSize="inherit" />}
              </S.AssigneeChip>
            ) : (
              canAssign && (
                <S.AssigneeChip type="button" data-testid="review-assign-me" onClick={() => setDialog('assign')}>
                  <AssignIcon fontSize="small" />
                  {t('item_editor.review.assign_to_me')}
                </S.AssigneeChip>
              )
            )}
          </>
        )}
      </S.Meta>

      {!isLoading && !isCurationError && actions.length > 0 && (
        <S.Actions>
          {actions.map(action => (
            <Button
              key={action}
              type="button"
              size="sm"
              variant={action === ReviewAction.APPROVE || action === ReviewAction.ENABLE ? 'primary' : 'dark'}
              data-testid={`review-action-${action}`}
              onClick={() => onAction(action)}
            >
              {t(`item_editor.review.action.${action}`)}
            </Button>
          ))}
        </S.Actions>
      )}

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
          description={t(
            collection.isApproved ? 'item_editor.review.reject.changes' : 'item_editor.review.reject.first'
          )}
          error={reject.isError ? t('item_editor.review.reject.error') : null}
          busy={reject.isPending}
          onClose={closeDialog}
          cancel={{ label: t('item_editor.review.cancel'), onClick: closeDialog, testId: 'review-reject-cancel' }}
          confirm={{
            label: t('item_editor.review.reject.confirm'),
            testId: 'review-reject-confirm',
            onClick: () =>
              reject.mutate(
                { collection, curation },
                {
                  onSuccess: () => {
                    showToast(t('item_editor.review.reject.success', { collection: collection.name }))
                    closeDialog()
                    setVerdict(true)
                  }
                }
              )
          }}
          testId="review-reject"
        />
      )}
      {takeOver && (
        <AssignCuratorModal
          collection={collection}
          curation={curation}
          address={address}
          mode="self"
          onClose={() => setTakeOver(null)}
          onAssigned={() => {
            setTakeOver(null)
            runAction(takeOver)
          }}
        />
      )}
      {dialog === 'disable' && (
        <DisableCollectionFlow
          session={session}
          collection={collection}
          onClose={closeDialog}
          onDisabled={() => setVerdict(true)}
        />
      )}
      {verdict && collection.forumLink && (
        <ForumVerdictModal
          collection={{ ...collection, forumLink: collection.forumLink }}
          onClose={() => setVerdict(false)}
        />
      )}
      {approval && (
        <ApprovalFlowModal
          session={session}
          collection={collection}
          curation={curation}
          mode={approval}
          items={items}
          onClose={() => setApproval(null)}
        />
      )}
    </S.ReviewBar>
  )
}

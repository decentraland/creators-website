import { useMemo, useState } from 'react'
import { useIntl } from 'react-intl'
import {
  ArrowBack as ArrowBackIcon,
  AutoAwesome as VerdictIcon,
  Edit as EditIcon,
  PersonAddAlt as AssignIcon
} from '@mui/icons-material'
import { useTranslation } from '~/intl'
import { AssignCuratorModal } from '~/components/AssignCuratorModal'
import { Button } from '~/components/Button'
import { ConfirmModal } from '~/components/ConfirmModal'
import { CurationStatePill } from '~/components/CurationStatePill'
import { ProfileBadge } from '~/components/ProfileBadge'
import { ReviewStagePill } from '~/components/ReviewStagePill'
import { useCollectionEvents } from '~/hooks/useCollectionEvents'
import { useCollectionCuration, useDisableCollection } from '~/hooks/useCuration'
import { useItemSyncs } from '~/hooks/useItemSync'
import { type ApprovalMode } from '~/hooks/useApprovalFlow'
import { type Session } from '~/lib/auth'
import { type Collection } from '~/lib/collections'
import { ReviewAction, canEditAssignee, getCurationState, getReviewActions, getReviewStage } from '~/lib/curation'
import { getLatestVerdict } from '~/lib/events'
import { ItemSyncStatus } from '~/lib/itemSync'
import { type Item } from '~/lib/items'
import { useNotifications } from '~/lib/notifications'
import { formatTimeAgo } from '~/lib/time'
import { AiVerdictModal } from './AiVerdictModal'
import { ApprovalFlowModal } from './ApprovalFlowModal'
import { RejectCurationModal } from './RejectCurationModal'
import * as S from './ReviewBar.styles'

type Props = {
  session: Session
  collection: Collection
  items: Item[]
}

type Dialog = 'assign' | 'reject' | 'disable' | 'verdict' | null

/** The curator's toolbar over the read-only editor: the collection's review state and the committee's actions. */
export function ReviewBar({ session, collection, items }: Props) {
  const { t } = useTranslation()
  const intl = useIntl()
  const address = session.address
  const showToast = useNotifications(state => state.showToast)
  const curationQuery = useCollectionCuration(address, collection)
  const curation = curationQuery.data ?? null
  const syncs = useItemSyncs(address, collection, items)
  const { events } = useCollectionEvents(address, collection)
  const disable = useDisableCollection(session)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [approval, setApproval] = useState<ApprovalMode | null>(null)

  const hasMissingEntities = useMemo(
    () => [...syncs.values()].some(sync => sync.status === ItemSyncStatus.UNSYNCED && !sync.entity),
    [syncs]
  )
  const state = getCurationState(collection, curation)
  const stage = getReviewStage(curation, events[0] ?? null)
  const verdict = useMemo(() => getLatestVerdict(events), [events])
  const actions = collection.isPublished ? getReviewActions(collection, curation, hasMissingEntities) : []
  const assignee = curation?.assignee ?? null
  const isLoading = collection.isPublished && curationQuery.isLoading

  function onAction(action: ReviewAction) {
    if (action === ReviewAction.APPROVE || action === ReviewAction.ENABLE) setApproval('approve')
    else if (action === ReviewAction.DEPLOY_MISSING) setApproval('deploy_missing')
    else if (action === ReviewAction.REJECT) setDialog('reject')
    else setDialog('disable')
  }

  const closeDialog = () => {
    setDialog(null)
    disable.reset()
  }

  return (
    <S.ReviewBar role="toolbar" aria-label={t('item_editor.review.title')} data-testid="review-bar">
      <S.Identity>
        <S.BackLink to="/curation" aria-label={t('item_editor.review.back')} data-testid="review-back">
          <ArrowBackIcon fontSize="small" />
        </S.BackLink>
        <S.Name title={collection.name}>{collection.name}</S.Name>
        {!isLoading && (stage ? <ReviewStagePill stage={stage} /> : <CurationStatePill state={state} />)}
      </S.Identity>

      <S.Meta>
        {!collection.isPublished ? (
          <span data-testid="review-unpublished">{t('item_editor.review.unpublished')}</span>
        ) : (
          <>
            <span data-testid="review-requested">
              {curation
                ? t('item_editor.review.requested', { time: formatTimeAgo(curation.createdAt, intl.locale) })
                : t('item_editor.review.published', { time: formatTimeAgo(collection.createdAt, intl.locale) })}
            </span>
            {verdict && (
              <S.AssigneeChip
                type="button"
                data-verdict={verdict.payload.verdict}
                data-testid="review-ai-verdict"
                onClick={() => setDialog('verdict')}
              >
                <VerdictIcon fontSize="small" />
                {t('ai_verdict.button')}
              </S.AssigneeChip>
            )}
            {assignee ? (
              <S.AssigneeChip
                type="button"
                disabled={!canEditAssignee(collection, curation)}
                aria-label={t('item_editor.review.change_assignee')}
                data-testid="review-assignee"
                onClick={() => setDialog('assign')}
              >
                <ProfileBadge address={assignee} self={assignee === address.toLowerCase()} />
                {canEditAssignee(collection, curation) && <EditIcon fontSize="inherit" />}
              </S.AssigneeChip>
            ) : (
              <S.AssigneeChip type="button" data-testid="review-assign-me" onClick={() => setDialog('assign')}>
                <AssignIcon fontSize="small" />
                {t('item_editor.review.assign_to_me')}
              </S.AssigneeChip>
            )}
          </>
        )}
      </S.Meta>

      {!isLoading && actions.length > 0 && (
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
        <RejectCurationModal collection={collection} curation={curation} address={address} onClose={closeDialog} />
      )}
      {dialog === 'verdict' && verdict && <AiVerdictModal verdict={verdict} items={items} onClose={closeDialog} />}
      {dialog === 'disable' && (
        <ConfirmModal
          title={t('item_editor.review.disable.title', { collection: collection.name })}
          description={t('item_editor.review.disable.description')}
          error={disable.isError ? t('item_editor.review.disable.error') : null}
          busy={disable.isPending}
          onClose={closeDialog}
          cancel={{ label: t('item_editor.review.cancel'), onClick: closeDialog, testId: 'review-disable-cancel' }}
          confirm={{
            label: t('item_editor.review.disable.confirm'),
            testId: 'review-disable-confirm',
            onClick: () =>
              disable.mutate(collection, {
                onSuccess: () => {
                  showToast(t('item_editor.review.disable.success', { collection: collection.name }))
                  closeDialog()
                }
              })
          }}
          testId="review-disable"
        />
      )}
      {approval && (
        <ApprovalFlowModal
          session={session}
          collection={collection}
          curation={curation}
          mode={approval}
          onClose={() => setApproval(null)}
        />
      )}
    </S.ReviewBar>
  )
}

import { useMemo, useState } from 'react'
import { useIntl } from 'react-intl'
import { ArrowBack as ArrowBackIcon, Edit as EditIcon, PersonAddAlt as AssignIcon } from '@mui/icons-material'
import { useTranslation } from '~/intl'
import { AssignCuratorModal } from '~/components/AssignCuratorModal'
import { Button } from '~/components/Button'
import { ConfirmModal } from '~/components/ConfirmModal'
import { CurationStatePill } from '~/components/CurationStatePill'
import { ProfileBadge } from '~/components/ProfileBadge'
import { useCollectionCuration, useDisableCollection, useRejectCuration } from '~/hooks/useCuration'
import { useItemSyncs } from '~/hooks/useItemSync'
import { type ApprovalMode } from '~/hooks/useApprovalFlow'
import { type Session } from '~/lib/auth'
import { type Collection } from '~/lib/collections'
import { ReviewAction, canEditAssignee, getCurationState, getReviewActions } from '~/lib/curation'
import { ItemSyncStatus } from '~/lib/itemSync'
import { type Item } from '~/lib/items'
import { useNotifications } from '~/lib/notifications'
import { formatTimeAgo } from '~/lib/time'
import { ApprovalFlowModal } from './ApprovalFlowModal'
import * as S from './ReviewBar.styles'

type Props = {
  session: Session
  collection: Collection
  items: Item[]
}

type Dialog = 'assign' | 'reject' | 'disable' | null

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
  const disable = useDisableCollection(session)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [approval, setApproval] = useState<ApprovalMode | null>(null)

  const hasMissingEntities = useMemo(
    () => [...syncs.values()].some(sync => sync.status === ItemSyncStatus.UNSYNCED && !sync.entity),
    [syncs]
  )
  const state = getCurationState(collection, curation)
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
    reject.reset()
    disable.reset()
  }

  return (
    <S.ReviewBar role="toolbar" aria-label={t('item_editor.review.title')} data-testid="review-bar">
      <S.Identity>
        <S.BackLink to="/curation" aria-label={t('item_editor.review.back')} data-testid="review-back">
          <ArrowBackIcon fontSize="small" />
        </S.BackLink>
        <S.Name title={collection.name}>{collection.name}</S.Name>
        {!isLoading && <CurationStatePill state={state} />}
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
                  }
                }
              )
          }}
          testId="review-reject"
        />
      )}
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

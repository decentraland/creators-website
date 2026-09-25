import { useEffect, useState } from 'react'
import { CheckCircleOutline as DoneIcon } from '@mui/icons-material'
import { useTranslation } from '~/intl'
import { Button } from '~/components/Button'
import { Modal } from '~/components/Modal'
import { shortAddress } from '~/components/ProfileBadge'
import { useApprovalFlow, type ApprovalMode } from '~/hooks/useApprovalFlow'
import { useAssignCurator } from '~/hooks/useCuration'
import { useProfile } from '~/hooks/useProfile'
import { type Session } from '~/lib/auth'
import { type Collection } from '~/lib/collections'
import { type CollectionCuration } from '~/lib/curation'
import * as S from './ReviewBar.styles'

type Props = {
  session: Session
  collection: Collection
  curation: CollectionCuration | null
  mode: ApprovalMode
  onClose: () => void
}

/** The committee's approval, one step per screen: confirm assignment, rescue hashes, deploy entities, approve. */
export function ApprovalFlowModal({ session, collection, curation, mode, onClose }: Props) {
  const { t } = useTranslation()
  const self = session.address.toLowerCase()
  const assignedToOther = mode === 'approve' && !!curation?.assignee && curation.assignee !== self
  const [confirmed, setConfirmed] = useState(!assignedToOther)
  const assign = useAssignCurator(session.address)
  const { data: assigneeProfile } = useProfile(assignedToOther ? curation.assignee! : undefined)
  const flow = useApprovalFlow(session, collection, curation, mode)
  const { start, stop } = flow

  useEffect(() => {
    if (!confirmed) return
    void start()
    return stop
  }, [confirmed, start, stop])

  const view = flow.view
  const busy =
    assign.isPending ||
    (view.kind === 'rescue' && view.busy) ||
    (view.kind === 'deploy' && view.busy) ||
    (view.kind === 'approve' && view.busy)
  const titleKey = !confirmed ? 'assigned_to_other' : view.kind

  function assignAndApprove() {
    assign.mutate({ collection, curation, assignee: self }, { onSuccess: updated => setConfirmed(!!updated) })
  }

  let body: React.ReactNode
  let action: React.ReactNode = null
  if (!confirmed) {
    const assignee = assigneeProfile?.name || shortAddress(curation!.assignee!)
    body = <S.FlowText>{t('approval_flow.assigned_to_other.body', { assignee })}</S.FlowText>
    action = (
      <Button type="button" loading={assign.isPending} data-testid="approval-assign-confirm" onClick={assignAndApprove}>
        {t('approval_flow.assigned_to_other.action')}
      </Button>
    )
  } else if (view.kind === 'loading') {
    body = (
      <S.FlowCenter data-testid="approval-loading">
        <span className="spinner" aria-hidden />
        <S.FlowText>{t('approval_flow.loading.body')}</S.FlowText>
      </S.FlowCenter>
    )
  } else if (view.kind === 'rescue') {
    body = (
      <S.FlowText>
        {view.busy && view.total > 0
          ? t('approval_flow.rescue.progress', { sent: view.sent, total: view.total })
          : t('approval_flow.rescue.body', { count: view.count })}
      </S.FlowText>
    )
    action = (
      <Button type="button" loading={view.busy} data-testid="approval-rescue" onClick={() => void flow.runRescue()}>
        {t('approval_flow.rescue.action')}
      </Button>
    )
  } else if (view.kind === 'deploy') {
    body = (
      <S.FlowText>
        {view.busy
          ? t('approval_flow.deploy.progress', { done: view.done, total: view.count })
          : view.failed > 0
            ? t('approval_flow.deploy.failed', { count: view.failed })
            : t('approval_flow.deploy.body', { count: view.count })}
      </S.FlowText>
    )
    action = (
      <Button type="button" loading={view.busy} data-testid="approval-deploy" onClick={() => void flow.runDeploy()}>
        {t(view.failed > 0 ? 'approval_flow.deploy.retry' : 'approval_flow.deploy.action')}
      </Button>
    )
  } else if (view.kind === 'approve') {
    body = <S.FlowText>{t('approval_flow.approve.body')}</S.FlowText>
    action = (
      <Button type="button" loading={view.busy} data-testid="approval-approve" onClick={() => void flow.runApprove()}>
        {t('approval_flow.approve.action')}
      </Button>
    )
  } else if (view.kind === 'success') {
    body = (
      <S.FlowCenter data-testid="approval-success">
        <S.DoneGlyph aria-hidden>
          <DoneIcon />
        </S.DoneGlyph>
        <S.FlowText>{t(`approval_flow.success.body_${mode}`, { collection: collection.name })}</S.FlowText>
      </S.FlowCenter>
    )
    action = (
      <Button type="button" data-testid="approval-done" onClick={onClose}>
        {t('approval_flow.success.action')}
      </Button>
    )
  } else {
    body = <S.FlowText data-testid="approval-error">{t(`approval_flow.error.${view.step}`)}</S.FlowText>
    action = (
      <Button type="button" data-testid="approval-retry" onClick={() => void start()}>
        {t('approval_flow.error.retry')}
      </Button>
    )
  }

  return (
    <Modal
      title={t(`approval_flow.${titleKey}.title`, { collection: collection.name })}
      onClose={onClose}
      closeDisabled={busy}
      compact
      testId="approval-flow-modal"
    >
      <S.FlowBody data-view={confirmed ? view.kind : 'assigned_to_other'}>
        {body}
        <S.FlowActions>
          {view.kind !== 'success' && (
            <Button type="button" variant="secondary" disabled={busy} onClick={onClose}>
              {t('approval_flow.cancel')}
            </Button>
          )}
          {action}
        </S.FlowActions>
      </S.FlowBody>
    </Modal>
  )
}

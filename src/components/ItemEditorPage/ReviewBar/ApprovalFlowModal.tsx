import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight as ChevronRightIcon } from '@mui/icons-material'
import approvedArt from '~/assets/send-success.png'
import errorArt from '~/assets/modal-error.png'
import { useTranslation, type Translate } from '~/intl'
import { Button } from '~/components/Button'
import { CollectionMosaic } from '~/components/CollectionMosaic'
import { ConfirmModal } from '~/components/ConfirmModal'
import { BodyShapeIcon, CategoryIcon } from '~/components/ItemIcons'
import { ItemThumbnail } from '~/components/ItemThumbnail'
import { Modal } from '~/components/Modal'
import { RarityPill } from '~/components/RarityPill'
import { StepIndicator } from '~/components/StepIndicator'
import { SuccessModal } from '~/components/SuccessModal'
import { PendingModal } from '~/components/CollectionDetailPage/SellItemFlow/PendingModal'
import { useApprovalFlow, type ApprovalMode, type ApprovalPlan, type ApprovalStep } from '~/hooks/useApprovalFlow'
import { useAssignCurator } from '~/hooks/useCuration'
import { useProfile } from '~/hooks/useProfile'
import { track } from '~/lib/analytics'
import { measureItems } from '~/lib/approveCollection'
import { isSocialLogin, type Session } from '~/lib/auth'
import { fetchContentSize, getContentsStorageUrl } from '~/lib/builder'
import { type Collection } from '~/lib/collections'
import { type CollectionCuration } from '~/lib/curation'
import { shortAddress } from '~/lib/ids'
import { getItemBodyShapeType, type Item } from '~/lib/items'
import * as F from './ReviewBar.styles'
import * as S from './ApprovalFlowModal.styles'

type Props = {
  session: Session
  collection: Collection
  curation: CollectionCuration | null
  mode: ApprovalMode
  onClose: () => void
}

const MB = 1024 * 1024

function formatSize(t: Translate, bytes: number): string {
  return bytes >= MB
    ? t('approval_flow.size_mb', { size: (bytes / MB).toFixed(1) })
    : t('approval_flow.size_kb', { size: (bytes / 1024).toFixed(1) })
}

const shortHash = (hash: string) => `${hash.slice(0, 6)}...${hash.slice(-6)}`

/** The committee's approval: confirm the assignment, then one stepper screen per transaction or upload. */
export function ApprovalFlowModal({ session, collection, curation, mode, onClose }: Props) {
  const { t } = useTranslation()
  const self = session.address.toLowerCase()
  const assignedToOther = mode === 'approve' && !!curation?.assignee && curation.assignee !== self
  const [confirmed, setConfirmed] = useState(!assignedToOther)
  const assign = useAssignCurator(session.address)
  const { data: assigneeProfile } = useProfile(assignedToOther ? curation.assignee! : undefined)
  const flow = useApprovalFlow(session, collection, curation, mode)
  const { view, plan, start, stop } = flow

  // Runs once per confirmation: the collection and curation refetch mid-flow, which recreates `start`,
  // and re-running it would reopen the flow from its first step.
  useEffect(() => {
    if (!confirmed) return
    void start()
    return stop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmed])

  if (!confirmed) {
    const assignee = assigneeProfile?.name || shortAddress(curation!.assignee!)
    return (
      <Modal
        title={t('approval_flow.assigned_to_other.title', { collection: collection.name })}
        onClose={onClose}
        closeDisabled={assign.isPending}
        testId="approval-flow-modal"
      >
        <F.FlowBody data-view="assigned_to_other">
          <F.FlowText>{t('approval_flow.assigned_to_other.body', { assignee })}</F.FlowText>
          {assign.isError && (
            <F.FlowText data-testid="approval-assign-error">{t('assign_curator_modal.error')}</F.FlowText>
          )}
          <F.FlowActions>
            <Button type="button" variant="secondary" disabled={assign.isPending} onClick={onClose}>
              {t('approval_flow.cancel')}
            </Button>
            <Button
              type="button"
              loading={assign.isPending}
              data-testid="approval-assign-confirm"
              onClick={() =>
                assign.mutate(
                  { collection, curation, assignee: self },
                  { onSuccess: updated => setConfirmed(!!updated) }
                )
              }
            >
              {t('approval_flow.assigned_to_other.action')}
            </Button>
          </F.FlowActions>
        </F.FlowBody>
      </Modal>
    )
  }

  switch (view.kind) {
    case 'loading':
      return <PendingModal label={t('approval_flow.loading')} onCancel={onClose} testId="approval-loading" />
    case 'success':
      return (
        <SuccessModal
          title={t(`approval_flow.success.title_${mode}`)}
          description={t(`approval_flow.success.body_${mode}`, { collection: collection.name })}
          art={approvedArt}
          onDone={onClose}
        />
      )
    case 'error':
      return (
        <ConfirmModal
          title={t(`approval_flow.error.title_${mode}`)}
          description={t(`approval_flow.error.${view.step}`)}
          art={{ src: errorArt }}
          onClose={onClose}
          cancel={{ label: t('approval_flow.cancel'), onClick: onClose, testId: 'approval-error-cancel' }}
          confirm={{ label: t('approval_flow.error.retry'), onClick: () => void start(), testId: 'approval-retry' }}
          testId="approval-error"
        >
          <ErrorDetail
            collectionId={collection.id}
            text={[
              ...view.failed.map(failure => `${failure.item.name}: ${failure.message}`),
              ...(view.failed.length ? [] : [view.detail ?? ''])
            ]
              .filter(Boolean)
              .join('\n')}
          />
        </ConfirmModal>
      )
  }

  const { step, phase } = view
  // Custodial wallets sign without a prompt to wait on: their screen just spins the confirm button.
  if (phase.kind === 'signing' && !isSocialLogin(session)) {
    return (
      <PendingModal
        title={t('approval_flow.signature_title')}
        label={t(`approval_flow.${step}.signing`)}
        onCancel={flow.cancelSigning}
        testId="approval-signing"
      />
    )
  }
  if (phase.kind === 'pending') {
    return (
      <PendingModal
        label={t(`approval_flow.${step}.pending`, { tx: phase.tx, txs: phase.txs })}
        testId="approval-pending"
      />
    )
  }

  const busy = phase.kind !== 'idle'
  const run = { rescue: flow.runRescue, deploy: flow.runDeploy, approve: flow.runApprove }[step]
  const count = step === 'rescue' ? plan.rescue.length : plan.deploy.length

  return (
    <Modal
      title={t('approval_flow.title')}
      onClose={onClose}
      closeDisabled={busy}
      size="large"
      testId="approval-flow-modal"
    >
      <S.Main>
        {plan.steps.length > 1 && (
          <StepIndicator current={plan.steps.indexOf(step) + 1} total={plan.steps.length} testId="approval-steps" />
        )}
        <S.Step data-testid={`approval-step-${step}`}>
          {phase.kind === 'uploading' ? (
            <>
              <S.Heading>{t('approval_flow.deploy.uploading_title')}</S.Heading>
              <S.Text>{t('approval_flow.deploy.uploading_body')}</S.Text>
              <S.ProgressLabel>{t('approval_flow.deploy.uploading')}</S.ProgressLabel>
              <S.ProgressRow>
                <S.ProgressBar value={phase.done} max={phase.total} data-testid="approval-upload-progress" />
                <span>
                  {phase.done}/{phase.total}
                </span>
              </S.ProgressRow>
            </>
          ) : (
            <>
              <S.Heading>{t(`approval_flow.${step}.title`)}</S.Heading>
              <S.Text>{t(`approval_flow.${step}.body`, { count })}</S.Text>
              <StepTable step={step} plan={plan} collection={collection} />
              <S.Footer>
                <Button type="button" variant="secondary" disabled={busy} onClick={onClose}>
                  {t('approval_flow.cancel')}
                </Button>
                <Button type="button" loading={busy} data-testid={`approval-${step}`} onClick={() => void run()}>
                  {t(`approval_flow.${step}.action`)}
                  <ChevronRightIcon fontSize="small" />
                </Button>
              </S.Footer>
            </>
          )}
        </S.Step>
      </S.Main>
    </Modal>
  )
}

function ItemName({ item }: { item: Item }) {
  const thumbnail = item.contents[item.thumbnail]
  return (
    <S.NameCell>
      <S.Thumb>
        <ItemThumbnail src={thumbnail ? getContentsStorageUrl(thumbnail) : null} rarity={item.rarity} />
      </S.Thumb>
      <span title={item.name}>{item.name}</span>
    </S.NameCell>
  )
}

function StepTable({ step, plan, collection }: { step: ApprovalStep; plan: ApprovalPlan; collection: Collection }) {
  const { t } = useTranslation()
  const sizes = useQuery({
    queryKey: ['approval-item-sizes', plan.deploy.map(item => item.id)],
    queryFn: () => measureItems(plan.deploy, fetchContentSize),
    enabled: step === 'deploy',
    staleTime: Infinity
  })
  const column = (key: string, optional = false) => (
    <span data-optional={optional || undefined}>{t(`approval_flow.columns.${key}`)}</span>
  )

  if (step === 'approve') {
    return (
      <S.Table>
        <S.Header data-table={step}>
          {column('collection')}
          {column('items')}
        </S.Header>
        <S.Row data-table={step} data-testid="approval-collection-row">
          <S.NameCell>
            <S.MosaicFrame>
              <CollectionMosaic collectionId={collection.id} itemCount={collection.itemCount} />
            </S.MosaicFrame>
            <span title={collection.name}>{collection.name}</span>
          </S.NameCell>
          <span>{t('approval_flow.item_count', { count: collection.itemCount })}</span>
        </S.Row>
      </S.Table>
    )
  }

  if (step === 'deploy') {
    return (
      <S.Table>
        <S.Header data-table={step}>
          {column('item')}
          {column('size')}
        </S.Header>
        <S.TableBody>
          {plan.deploy.map(item => {
            const bytes = sizes.data?.get(item.id)
            return (
              <S.Row key={item.id} data-table={step} data-testid="approval-item-row">
                <ItemName item={item} />
                <span data-testid="approval-item-size">{bytes === undefined ? '—' : formatSize(t, bytes)}</span>
              </S.Row>
            )
          })}
        </S.TableBody>
      </S.Table>
    )
  }

  return (
    <S.Table>
      <S.Header data-table={step}>
        {column('item')}
        {column('body_shape', true)}
        {column('category', true)}
        {column('rarity')}
        {column('hash', true)}
      </S.Header>
      <S.TableBody>
        {plan.rescue.map(({ item, contentHash }) => {
          const bodyShape = getItemBodyShapeType(item)
          return (
            <S.Row key={item.id} data-table={step} data-testid="approval-item-row">
              <ItemName item={item} />
              <span data-optional>{bodyShape ? <BodyShapeIcon bodyShape={bodyShape} withLabel /> : '—'}</span>
              <span data-optional>
                {item.data.category ? <CategoryIcon category={item.data.category} withLabel /> : '—'}
              </span>
              <span>{item.rarity && <RarityPill rarity={item.rarity} />}</span>
              <span data-optional title={contentHash}>
                {shortHash(contentHash)}
              </span>
            </S.Row>
          )
        })}
      </S.TableBody>
    </S.Table>
  )
}

/** The raw failure, which only curators see: support asks for it, so it can be copied whole. */
function ErrorDetail({ text, collectionId }: { text: string; collectionId: string }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  if (!text) return null
  return (
    <S.Detail>
      <S.DetailHeader>
        <span>{t('approval_flow.error.details')}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          data-testid="approval-error-copy"
          onClick={() => {
            void navigator.clipboard?.writeText(text).then(() => setCopied(true))
            track('Approval error details copied', { collectionId })
          }}
        >
          {t(copied ? 'approval_flow.error.copied' : 'approval_flow.error.copy')}
        </Button>
      </S.DetailHeader>
      <S.DetailText data-testid="approval-error-detail">{text}</S.DetailText>
    </S.Detail>
  )
}

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Check as CheckIcon,
  ChevronRight as ChevronRightIcon,
  ContentCopy as ContentCopyIcon
} from '@mui/icons-material'
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
import { Tooltip } from '~/components/Tooltip'
import { ProgressModal } from '~/components/ProgressModal'
import { PendingModal } from '~/components/CollectionDetailPage/SellItemFlow/PendingModal'
import { useApprovalFlow, type ApprovalMode, type ApprovalPlan, type ApprovalStep } from '~/hooks/useApprovalFlow'
import { useBeforeUnloadGuard } from '~/hooks/useBeforeUnloadGuard'
import { track } from '~/lib/analytics'
import { measureItems } from '~/lib/approveCollection'
import { isSocialLogin, type Session } from '~/lib/auth'
import { copyToClipboard } from '~/lib/clipboard'
import { fetchContentSize, getContentsStorageUrl } from '~/lib/builder'
import { type Collection } from '~/lib/collections'
import { type CollectionCuration } from '~/lib/curation'
import { getItemBodyShapeType, type Item } from '~/lib/items'
import * as S from './ApprovalFlowModal.styles'

type Props = {
  session: Session
  collection: Collection
  curation: CollectionCuration | null
  mode: ApprovalMode
  onClose: () => void
}

const MB = 1024 * 1024
const COPIED_FEEDBACK_MS = 1500

function formatSize(t: Translate, bytes: number): string {
  return bytes >= MB
    ? t('approval_flow.size_mb', { size: (bytes / MB).toFixed(1) })
    : t('approval_flow.size_kb', { size: (bytes / 1024).toFixed(1) })
}

const shortHash = (hash: string) => `${hash.slice(0, 6)}...${hash.slice(-6)}`

/** The committee's approval: one stepper screen per transaction or upload. */
export function ApprovalFlowModal({ session, collection, curation, mode, onClose }: Props) {
  const { t } = useTranslation()
  const flow = useApprovalFlow(session, collection, curation, mode)
  const { view, plan, start, stop } = flow
  // Reloading mid-transaction or mid-upload loses track of it; the flow would have to start over.
  useBeforeUnloadGuard(view.kind === 'step' && view.phase.kind !== 'idle')

  // Runs once: the collection and curation refetch mid-flow, which recreates `start`, and re-running it would
  // reopen the flow from its first step.
  useEffect(() => {
    void start()
    return stop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
  if (phase.kind === 'uploading') {
    return (
      <ProgressModal
        title={t('approval_flow.title')}
        heading={t('approval_flow.deploy.uploading_title')}
        description={t('approval_flow.deploy.uploading_body')}
        label={t('approval_flow.deploy.uploading')}
        done={phase.done}
        total={phase.total}
        testId="approval-uploading"
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
  const single = plan.steps.length === 1
  // Only a step with another one after it continues; the last one completes the approval.
  const isLast = plan.steps.indexOf(step) === plan.steps.length - 1

  return (
    <Modal
      title={t(single ? `approval_flow.${step}.title` : 'approval_flow.title')}
      onClose={onClose}
      closeDisabled={busy}
      size="large"
      testId="approval-flow-modal"
    >
      <S.Main data-single={single || undefined}>
        {!single && (
          <StepIndicator current={plan.steps.indexOf(step) + 1} total={plan.steps.length} testId="approval-steps" />
        )}
        <S.Step data-testid={`approval-step-${step}`}>
          {!single && <S.Heading>{t(`approval_flow.${step}.title`)}</S.Heading>}
          <S.Text>{t(`approval_flow.${step}.body`, { count })}</S.Text>
          <StepTable step={step} plan={plan} collection={collection} />
          <S.Footer>
            <Button type="button" variant="secondary" disabled={busy} onClick={onClose}>
              {t('approval_flow.cancel')}
            </Button>
            <Button type="button" loading={busy} data-testid={`approval-${step}`} onClick={() => void run()}>
              {t(`approval_flow.${step}.action`)}
              {!isLast && <ChevronRightIcon fontSize="small" />}
            </Button>
          </S.Footer>
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
  const [copied, setCopied] = useState<boolean | null>(null)
  useEffect(() => {
    if (copied === null) return
    const reset = setTimeout(() => setCopied(null), COPIED_FEEDBACK_MS)
    return () => clearTimeout(reset)
  }, [copied])
  if (!text) return null
  const label =
    copied === null
      ? t('approval_flow.error.copy')
      : t(copied ? 'approval_flow.error.copied' : 'collection_detail_page.actions.copy_failed')
  return (
    <S.Detail>
      <S.DetailHeader>
        <span>{t('approval_flow.error.details')}</span>
        <Tooltip content={label} asChild placement="top">
          <S.CopyButton
            type="button"
            aria-label={label}
            data-copied={copied || undefined}
            data-testid="approval-error-copy"
            onClick={() => {
              void copyToClipboard(text).then(setCopied)
              track('Approval error details copied', { collectionId })
            }}
          >
            {copied ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
          </S.CopyButton>
        </Tooltip>
      </S.DetailHeader>
      <S.DetailText data-testid="approval-error-detail">{text}</S.DetailText>
    </S.Detail>
  )
}

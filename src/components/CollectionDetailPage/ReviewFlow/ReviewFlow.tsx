import { useCallback, useEffect, useMemo, useState } from 'react'
import { ErrorOutline as ErrorIcon, InfoOutlined as InfoIcon } from '@mui/icons-material'
import { useTranslation } from '~/intl'
import { Button } from '~/components/Button'
import { useAppealCuration, useRequestValidation } from '~/hooks/useCollectionEvents'
import { track } from '~/lib/analytics'
import { BuilderServerError, VALIDATION_RUNNING_STATUS, ValidationLimitError } from '~/lib/builder'
import { type Collection } from '~/lib/collections'
import { ReviewStage, getCreatorReviewNotice, getReviewStage, type CollectionCuration } from '~/lib/curation'
import {
  VALIDATION_ATTEMPTS_PER_DAY,
  countValidationAttempts,
  getAiIssuesByItem,
  getLatestVerdict,
  hasOpenAppeal,
  isFinalValidationError,
  isUnsupportedItemsReview,
  isValidationRunning,
  latestStageEvent,
  type CollectionEvent
} from '~/lib/events'
import { type Item } from '~/lib/items'
import { useNotifications } from '~/lib/notifications'
import {
  AdditionalReviewModal,
  AiIssuesModal,
  DailyLimitModal,
  RequestCuratorReviewModal,
  ReviewingModal,
  SentForReviewModal,
  type AiItemIssues
} from './ReviewModals'
import { markReviewModalSeen, wasReviewModalSeen } from './reviewModalMemory'
import * as S from './ReviewFlow.styles'

/** A modal the page asks for: right after publishing, or when submitted changes hit the daily limit. */
export type ReviewFlowRequest = 'reviewing' | 'limit'

type ReviewModal = ReviewFlowRequest | 'issues' | 'request' | 'sent' | 'additional'

type Props = {
  collection: Collection
  address: string
  curation: CollectionCuration | null
  /** `null` while the timeline is unavailable: only the legacy notice shows then. */
  events: CollectionEvent[] | null
  items: Item[]
  /** Owner or collaborator: may validate again and ask for a curator. */
  canManage: boolean
  request: ReviewFlowRequest | null
  onRequestHandled: () => void
}

/**
 * What the creator sees about a published collection's review: a one-line notice per stage, the modals the
 * review opens by itself (running, rejected, handed to a curator) and the ones the creator opens (ask a curator).
 */
export function ReviewFlow({
  collection,
  address,
  curation,
  events,
  items,
  canManage,
  request,
  onRequestHandled
}: Props) {
  const { t } = useTranslation()
  const showToast = useNotifications(state => state.showToast)
  const requestValidation = useRequestValidation(address)
  const appeal = useAppealCuration(address)
  const [modal, setModal] = useState<ReviewModal | null>(null)

  const timeline = useMemo(() => events ?? [], [events])
  const stage = useMemo(() => getReviewStage(collection, curation, events), [collection, curation, events])
  const verdict = useMemo(() => getLatestVerdict(timeline), [timeline])
  const aiResults = useMemo<AiItemIssues[]>(() => {
    const byItem = getAiIssuesByItem(timeline)
    return items.filter(item => byItem.has(item.id)).map(item => ({ item, issues: byItem.get(item.id)! }))
  }, [timeline, items])
  const attemptsUsed = useMemo(() => countValidationAttempts(timeline), [timeline])
  const attemptsLeft = Math.max(0, VALIDATION_ATTEMPTS_PER_DAY - attemptsUsed)
  const running = useMemo(() => isValidationRunning(timeline), [timeline])
  const appealOpen = useMemo(() => hasOpenAppeal(timeline), [timeline])
  const cause = useMemo(() => latestStageEvent(timeline), [timeline])

  const open = useCallback(
    (next: ReviewModal) => {
      setModal(next)
      track('Review Modal Opened', { collectionId: collection.id, stage, modal: next })
    },
    [collection.id, stage]
  )

  useEffect(() => {
    if (!request) return
    open(request)
    onRequestHandled()
  }, [request, open, onRequestHandled])

  // The verdict and the hand-off announce themselves once; the notice reopens the findings any time.
  useEffect(() => {
    if (modal || !canManage) return
    if (stage === ReviewStage.REJECTED_BY_VALIDATOR && verdict && aiResults.length > 0) {
      const key = `verdict:${verdict.id}`
      if (wasReviewModalSeen(collection.id, key)) return
      markReviewModalSeen(collection.id, key)
      open('issues')
    } else if (stage === ReviewStage.NEEDS_CURATOR && cause) {
      const key = `handoff:${cause.id}`
      if (wasReviewModalSeen(collection.id, key)) return
      markReviewModalSeen(collection.id, key)
      open('additional')
    }
  }, [modal, canManage, stage, verdict, aiResults.length, cause, collection.id, open])

  const close = () => {
    setModal(null)
    appeal.reset()
  }

  function validateAgain() {
    if (running || attemptsLeft === 0) {
      open('limit')
      return
    }
    requestValidation.mutate(
      { collection, events: timeline },
      {
        onSuccess: () => showToast(t('review_flow.validation_started')),
        onError: error => {
          if (error instanceof ValidationLimitError) open('limit')
          else if (error instanceof BuilderServerError && error.status === VALIDATION_RUNNING_STATUS) {
            showToast(t('review_flow.running'), { type: 'warn' })
          } else showToast(t('review_flow.validation_error'), { type: 'error' })
        }
      }
    )
  }

  function requestReview() {
    if (appealOpen) {
      showToast(t('review_flow.appeal_open'), { type: 'warn' })
      return
    }
    open('request')
  }

  function confirmReview() {
    appeal.mutate({ collection, note: '' }, { onSuccess: () => open('sent') })
  }

  const appealError =
    appeal.error instanceof BuilderServerError && appeal.error.status === VALIDATION_RUNNING_STATUS
      ? t('review_flow.appeal_open')
      : appeal.isError
        ? t('review_flow.appeal_error')
        : null

  const modals = (
    <>
      {modal === 'reviewing' && <ReviewingModal attemptsUsed={Math.max(attemptsUsed, 1)} onDone={close} />}
      {modal === 'issues' && (
        <AiIssuesModal results={aiResults} onRequestReview={canManage ? requestReview : undefined} onClose={close} />
      )}
      {modal === 'request' && (
        <RequestCuratorReviewModal
          busy={appeal.isPending}
          error={appealError}
          onConfirm={confirmReview}
          onClose={close}
        />
      )}
      {modal === 'sent' && <SentForReviewModal onDone={close} />}
      {modal === 'limit' && (
        <DailyLimitModal attemptsUsed={attemptsUsed} onRequestReview={requestReview} onClose={close} />
      )}
      {modal === 'additional' && <AdditionalReviewModal onDone={close} />}
    </>
  )

  if (!collection.isPublished) return modals

  let text: string | null = null
  let tone: 'info' | 'error' | undefined
  switch (stage) {
    case ReviewStage.AI_REVIEWING:
      text = t('review_flow.notice.ai_reviewing')
      tone = 'info'
      break
    case ReviewStage.AWAITING_CURATOR:
      text = t(
        curation?.assignee ? 'review_flow.notice.awaiting_curator_assigned' : 'review_flow.notice.awaiting_curator'
      )
      tone = 'info'
      break
    case ReviewStage.NEEDS_CURATOR:
      text = t(
        isUnsupportedItemsReview(cause)
          ? 'review_flow.notice.unsupported_items'
          : cause?.type === 'review.ai_error' && cause.payload.reason === 'too_large'
            ? 'review_flow.notice.too_large'
            : isFinalValidationError(cause)
              ? 'review_flow.notice.validator_failed'
              : 'review_flow.notice.human_review'
      )
      tone = 'info'
      break
    case ReviewStage.APPEALED:
      text = t('review_flow.notice.appealed')
      tone = 'info'
      break
    case ReviewStage.REJECTED_BY_VALIDATOR:
      text = t('review_flow.notice.rejected_by_validator')
      tone = 'error'
      break
    case ReviewStage.REJECTED_BY_CURATOR:
      text = t('review_flow.notice.rejected_by_curator')
      tone = 'error'
      break
    default: {
      const legacy = getCreatorReviewNotice(collection, curation)
      if (legacy) text = t(`collection_detail_page.review_notice.${legacy}`)
    }
  }
  if (!text) return modals

  const rejected = stage === ReviewStage.REJECTED_BY_VALIDATOR || stage === ReviewStage.REJECTED_BY_CURATOR

  return (
    <>
      <S.Notice data-testid="review-notice" data-stage={stage ?? undefined} data-tone={tone}>
        <S.NoticeText>
          {tone === 'error' ? <ErrorIcon fontSize="small" aria-hidden /> : <InfoIcon fontSize="small" aria-hidden />}
          <span>{text}</span>
          {stage === ReviewStage.REJECTED_BY_VALIDATOR && aiResults.length > 0 && (
            <S.SeeIssues type="button" data-testid="review-see-issues" onClick={() => open('issues')}>
              {t('review_flow.issues.see')}
            </S.SeeIssues>
          )}
        </S.NoticeText>
        {rejected && canManage && (
          <S.NoticeActions>
            {stage === ReviewStage.REJECTED_BY_VALIDATOR && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                loading={requestValidation.isPending}
                data-testid="validate-again"
                onClick={validateAgain}
              >
                {t('review_flow.validate_again', { left: attemptsLeft, max: VALIDATION_ATTEMPTS_PER_DAY })}
              </Button>
            )}
            <Button type="button" variant="dark" size="sm" data-testid="request-curator-review" onClick={requestReview}>
              {t('review_flow.request_review')}
            </Button>
          </S.NoticeActions>
        )}
      </S.Notice>
      {modals}
    </>
  )
}

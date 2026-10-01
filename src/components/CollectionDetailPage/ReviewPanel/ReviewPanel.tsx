import { useMemo, useState } from 'react'
import { useIntl } from 'react-intl'
import { ErrorOutline as ErrorIcon, InfoOutlined as InfoIcon } from '@mui/icons-material'
import { useTranslation } from '~/intl'
import { Button } from '~/components/Button'
import { ItemFindingsList } from '~/components/FindingsList'
import { Tooltip } from '~/components/Tooltip'
import { useRequestValidation } from '~/hooks/useCollectionEvents'
import { BuilderServerError, VALIDATION_RUNNING_STATUS, ValidationLimitError } from '~/lib/builder'
import { type Collection } from '~/lib/collections'
import {
  ReviewStage,
  getCreatorReviewNotice,
  getReviewStage,
  isRejectedStage,
  type CollectionCuration
} from '~/lib/curation'
import {
  SWEEP_EXHAUSTED_REASON,
  VALIDATION_ATTEMPTS_PER_DAY,
  getFailedItems,
  getLatestVerdict,
  getValidationAttemptsLeft,
  hasOpenAppeal,
  isFinalValidationError,
  isUnsupportedItemsReview,
  isValidationRunning,
  latestStageEvent,
  type CollectionEvent
} from '~/lib/events'
import { type Item } from '~/lib/items'
import { useNotifications } from '~/lib/notifications'
import { formatTimeUntil } from '~/lib/time'
import { AppealModal } from './AppealModal'
import * as S from './ReviewPanel.styles'

type Props = {
  collection: Collection
  address: string
  curation: CollectionCuration | null
  /** `null` while the timeline is unavailable: only the legacy notice shows then. */
  events: CollectionEvent[] | null
  items: Item[]
  /** Owner or collaborator: may validate again and appeal. */
  canManage: boolean
}

/**
 * What the creator sees about the review of a published collection: a one-line notice while it moves, or the
 * rejection (validator findings or curator reasons) with "Validate again" and "Request human review".
 */
export function ReviewPanel({ collection, address, curation, events, items, canManage }: Props) {
  const { t } = useTranslation()
  const intl = useIntl()
  const showToast = useNotifications(state => state.showToast)
  const requestValidation = useRequestValidation(address)
  const [isAppealOpen, setAppealOpen] = useState(false)

  const timeline = useMemo(() => events ?? [], [events])
  const stage = useMemo(() => getReviewStage(collection, curation, events), [collection, curation, events])
  const verdict = useMemo(() => getLatestVerdict(timeline), [timeline])
  const failedItems = useMemo(() => (verdict ? getFailedItems(verdict.payload) : []), [verdict])
  const attemptsLeft = useMemo(() => getValidationAttemptsLeft(timeline), [timeline])
  const running = useMemo(() => isValidationRunning(timeline), [timeline])
  const appealOpen = useMemo(() => hasOpenAppeal(timeline), [timeline])

  if (!collection.isPublished) return null

  const canRetry = canManage && attemptsLeft > 0 && !running

  function validateAgain() {
    requestValidation.mutate(
      { collection, events: timeline },
      {
        onSuccess: () => showToast(t('review_panel.validation_started')),
        onError: error => {
          if (error instanceof ValidationLimitError) {
            showToast(
              error.retryAt
                ? t('review_panel.validation_limit', { time: formatTimeUntil(error.retryAt, intl.locale) })
                : t('review_panel.validation_limit_tomorrow'),
              { type: 'warn' }
            )
          } else if (error instanceof BuilderServerError && error.status === VALIDATION_RUNNING_STATUS) {
            showToast(t('review_panel.validation_running'), { type: 'warn' })
          } else {
            showToast(t('review_panel.validation_error'), { type: 'error' })
          }
        }
      }
    )
  }

  const validateAgainActions = (
    <>
      <Tooltip
        content={
          attemptsLeft === 0
            ? t('review_panel.attempts_exhausted', { max: VALIDATION_ATTEMPTS_PER_DAY })
            : running
              ? t('review_panel.validation_running')
              : null
        }
        placement="top"
        asChild
      >
        <Button
          type="button"
          variant="primary"
          loading={requestValidation.isPending}
          aria-disabled={!canRetry || undefined}
          data-testid="validate-again"
          onClick={() => canRetry && validateAgain()}
        >
          {t('review_panel.validate_again')}
        </Button>
      </Tooltip>
      <S.Attempts data-testid="validation-attempts" data-exhausted={attemptsLeft === 0 || undefined}>
        {t('review_panel.attempts_left', { left: attemptsLeft, max: VALIDATION_ATTEMPTS_PER_DAY })}
      </S.Attempts>
    </>
  )

  if (!isRejectedStage(stage)) {
    const legacy = getCreatorReviewNotice(collection, curation)
    const cause = latestStageEvent(timeline)
    let text: string | null = null
    // Only a give-up after transient failures may go better on a new request; the other final errors repeat.
    let offerRetry = false
    if (stage === ReviewStage.AI_REVIEWING) text = t('review_panel.ai_reviewing')
    else if (stage === ReviewStage.AWAITING_CURATOR) {
      text = t(curation?.assignee ? 'review_panel.awaiting_curator_assigned' : 'review_panel.awaiting_curator')
    } else if (stage === ReviewStage.NEEDS_CURATOR) {
      if (isUnsupportedItemsReview(cause)) text = t('review_panel.unsupported_items')
      else if (cause?.type === 'review.ai_error' && cause.payload.reason === 'too_large') {
        text = t('review_panel.too_large')
      } else if (isFinalValidationError(cause)) {
        text = t('review_panel.validator_failed')
        offerRetry = canManage && cause?.payload.reason === SWEEP_EXHAUSTED_REASON
      } else text = t('review_panel.human_review')
    } else if (stage === ReviewStage.APPEALED) text = t('review_panel.appealed')
    else if (legacy) text = t(`collection_detail_page.review_notice.${legacy}`)
    if (!text) return null
    const notice = (
      <S.Notice data-testid="review-notice" data-stage={stage ?? legacy} data-tone={stage ? 'info' : undefined}>
        <InfoIcon fontSize="small" aria-hidden />
        {text}
      </S.Notice>
    )
    if (!offerRetry) return notice
    return (
      <S.NoticeGroup>
        {notice}
        <S.Actions>{validateAgainActions}</S.Actions>
      </S.NoticeGroup>
    )
  }

  const byValidator = stage === ReviewStage.REJECTED_BY_VALIDATOR

  return (
    <S.Panel data-testid="review-panel" data-stage={stage}>
      <S.Head>
        <ErrorIcon aria-hidden />
        <div>
          <S.Title>{t(`review_panel.${stage}.title`)}</S.Title>
          <S.Description>{t(`review_panel.${stage}.description`)}</S.Description>
        </div>
      </S.Head>

      {byValidator && verdict && (
        <ItemFindingsList results={failedItems} items={items} testId="review-panel-findings" />
      )}

      {!byValidator && (
        <>
          {curation?.rejectionReasons && curation.rejectionReasons.length > 0 && (
            <div>
              <S.Label>{t('review_panel.reasons')}</S.Label>
              <S.Reasons data-testid="review-panel-reasons">
                {curation.rejectionReasons.map(code => (
                  <S.Reason key={code} data-reason={code}>
                    {t(`reject_reason.${code}`)}
                  </S.Reason>
                ))}
              </S.Reasons>
            </div>
          )}
          {curation?.rejectionMessage && (
            <div>
              <S.Label>{t('review_panel.message')}</S.Label>
              <S.Message data-testid="review-panel-message">{curation.rejectionMessage}</S.Message>
            </div>
          )}
        </>
      )}

      {canManage ? (
        <S.Actions>
          {validateAgainActions}
          <Tooltip content={appealOpen ? t('review_panel.appeal_open') : null} placement="top" asChild>
            <Button
              type="button"
              variant="dark"
              aria-disabled={appealOpen || undefined}
              data-testid="request-human-review"
              onClick={() => !appealOpen && setAppealOpen(true)}
            >
              {t('review_panel.request_review')}
            </Button>
          </Tooltip>
        </S.Actions>
      ) : (
        <S.Hint>{t('review_panel.no_access')}</S.Hint>
      )}

      {isAppealOpen && <AppealModal collection={collection} address={address} onClose={() => setAppealOpen(false)} />}
    </S.Panel>
  )
}

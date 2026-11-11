import { useMemo } from 'react'
import { ReportProblemOutlined as ErrorIcon } from '@mui/icons-material'
import reviewArt from '~/assets/publish-success.png'
import limitArt from '~/assets/modal-error.png'
import { Button } from '~/components/Button'
import { ConfirmModal } from '~/components/ConfirmModal'
import { Modal } from '~/components/Modal'
import { SuccessModal } from '~/components/SuccessModal'
import { ItemValidationCard, toValidationSubject } from '~/components/ValidationBadge'
import { useTranslation } from '~/intl'
import { VALIDATION_ATTEMPTS_PER_DAY } from '~/lib/events'
import * as Issues from '../PublishCollectionModal/ValidationIssuesView.styles'
import { type ItemCheck } from '~/lib/validation'
import * as S from './ReviewFlow.styles'

type AttemptsProps = { used: number; testId: string }

/** "Automated reviews: N of 3 used today", under the copy of the review modals. */
function Attempts({ used, testId }: AttemptsProps) {
  const { t } = useTranslation()
  return (
    <S.Attempts data-testid={testId}>
      {t('review_flow.attempts', {
        used: Math.min(used, VALIDATION_ATTEMPTS_PER_DAY),
        max: VALIDATION_ATTEMPTS_PER_DAY
      })}
    </S.Attempts>
  )
}

/** Right after publishing: the automatic review is running, the creator can close and wait. */
export function ReviewingModal({ attemptsUsed, onDone }: { attemptsUsed: number; onDone: () => void }) {
  const { t } = useTranslation()
  return (
    <SuccessModal
      title={t('review_flow.reviewing.title')}
      description={
        <>
          {t('review_flow.reviewing.description')}
          <Attempts used={attemptsUsed} testId="reviewing-attempts" />
        </>
      }
      art={reviewArt}
      onDone={onDone}
      testId="reviewing-modal"
    />
  )
}

/** The validator could not decide: a curator takes over, no action needed. */
export function AdditionalReviewModal({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation()
  return (
    <SuccessModal
      title={t('review_flow.additional.title')}
      description={t('review_flow.additional.description')}
      art={reviewArt}
      onDone={onDone}
      testId="additional-review-modal"
    />
  )
}

/** The appeal went through: a curator will look at the collection. */
export function SentForReviewModal({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation()
  return (
    <SuccessModal
      title={t('review_flow.sent.title')}
      description={t('review_flow.sent.description')}
      art={reviewArt}
      onDone={onDone}
      testId="sent-for-review-modal"
    />
  )
}

type RequestProps = { busy: boolean; error: string | null; onConfirm: () => void; onClose: () => void }

/** Confirms the appeal before sending the rejected collection to a curator. */
export function RequestCuratorReviewModal({ busy, error, onConfirm, onClose }: RequestProps) {
  const { t } = useTranslation()
  return (
    <ConfirmModal
      icon={<ErrorIcon />}
      title={t('review_flow.request.title')}
      description={t('review_flow.request.description')}
      error={error}
      busy={busy}
      onClose={onClose}
      cancel={{ label: t('review_flow.request.cancel'), onClick: onClose, testId: 'request-review-cancel' }}
      confirm={{ label: t('review_flow.request.confirm'), onClick: onConfirm, testId: 'request-review-confirm' }}
      testId="request-review-modal"
    />
  )
}

type LimitProps = {
  attemptsUsed: number
  /** Only when the collection was rejected: a curator can't review submitted changes ahead of the queue. */
  onRequestReview?: () => void
  onClose: () => void
}

/** The day's automatic reviews are spent: wait, or ask a curator instead. */
export function DailyLimitModal({ attemptsUsed, onRequestReview, onClose }: LimitProps) {
  const { t } = useTranslation()
  return (
    <ConfirmModal
      art={{ src: limitArt }}
      title={t('review_flow.limit.title')}
      description={t(onRequestReview ? 'review_flow.limit.description' : 'review_flow.limit.description_wait', {
        max: VALIDATION_ATTEMPTS_PER_DAY
      })}
      onClose={onClose}
      cancel={{ label: t('review_flow.limit.not_now'), onClick: onClose, testId: 'daily-limit-not-now' }}
      confirm={
        onRequestReview
          ? { label: t('review_flow.limit.request'), onClick: onRequestReview, testId: 'daily-limit-request' }
          : undefined
      }
      testId="daily-limit-modal"
    >
      <Attempts used={attemptsUsed} testId="daily-limit-attempts" />
    </ConfirmModal>
  )
}

type IssuesProps = {
  results: ItemCheck[]
  /** Hidden for viewers who cannot appeal. */
  onRequestReview?: () => void
  onClose: () => void
}

/** The validator's findings per item, in the same dress as the browser's checks before publishing. */
export function AiIssuesModal({ results, onRequestReview, onClose }: IssuesProps) {
  const { t } = useTranslation()
  const sorted = useMemo(() => [...results].sort((a, b) => a.item.name.localeCompare(b.item.name)), [results])
  return (
    <Modal
      title={t('review_flow.issues.title')}
      size="large"
      hideTitle
      showClose
      onClose={onClose}
      testId="ai-issues-modal"
    >
      <Issues.Content data-variant="errors_blocking" data-testid="ai-issues-content">
        <Issues.Header>
          <Issues.HeaderIcon data-variant="errors" aria-hidden>
            <ErrorIcon />
          </Issues.HeaderIcon>
          <Issues.Title data-testid="ai-issues-title">{t('review_flow.issues.title')}</Issues.Title>
        </Issues.Header>
        <Issues.Intro>{t('review_flow.issues.intro')}</Issues.Intro>
        <Issues.List>
          {sorted.map(result => (
            <ItemValidationCard
              key={result.item.id}
              subject={toValidationSubject(result.item)}
              issues={result.issues}
              testId={`ai-issues-${result.item.id}`}
            />
          ))}
        </Issues.List>
        <Issues.Footer data-single={onRequestReview ? undefined : ''}>
          {onRequestReview && (
            <Button type="button" variant="secondary" data-testid="ai-issues-request-review" onClick={onRequestReview}>
              {t('review_flow.issues.request')}
            </Button>
          )}
          <Button type="button" variant="primary" data-testid="ai-issues-back" onClick={onClose}>
            {t('review_flow.issues.back')}
          </Button>
        </Issues.Footer>
      </Issues.Content>
    </Modal>
  )
}

import { useMemo, useState } from 'react'
import { useIntl } from 'react-intl'
import { useTranslation } from '~/intl'
import { ItemFindingsList } from '~/components/FindingsList'
import { ProfileBadge } from '~/components/ProfileBadge'
import {
  COLLECTION_EVENT_TYPES,
  countFailedItems,
  getFailedItems,
  SWEEP_EXHAUSTED_REASON,
  VALIDATOR_ERROR_REASON,
  isRejectReasonCode,
  isUnsupportedItemsReview,
  isValidationTrigger,
  type CollectionEvent,
  isTooLargeError
} from '~/lib/events'
import { shortenAddress } from '~/lib/address'
import { type Item } from '~/lib/items'
import { formatTimeAgo } from '~/lib/time'
import { useProfile } from '~/hooks/useProfile'
import * as S from './CollectionActivityModal.styles'

type Props = {
  event: CollectionEvent
  items: Item[]
  /** Committee members read the validator's own failure text. */
  isCurator: boolean
}

/** Types whose line reads as "{actor} did X"; the rest are system sentences without a subject. */
const ACTOR_LED = new Set([
  'collection.published',
  'review.appeal_requested',
  'review.assigned',
  'review.approved',
  'review.rejected',
  'changes.submitted',
  'review.comment',
  'collection.disabled'
])

function AssigneeName({ address }: { address: string }) {
  const { data: profile } = useProfile(address)
  return <>{profile?.name || shortenAddress(address)}</>
}

export function EventRow({ event, items, isCurator }: Props) {
  const { t } = useTranslation()
  const intl = useIntl()
  const [showFindings, setShowFindings] = useState(false)
  const { payload } = event
  const failedItems = useMemo(
    () => (payload.items ? getFailedItems({ verdict: 'rejected', items: payload.items }) : []),
    [payload.items]
  )
  const reasons = useMemo(() => (payload.rejectionReasons ?? []).filter(isRejectReasonCode), [payload.rejectionReasons])
  const known = (COLLECTION_EVENT_TYPES as readonly string[]).includes(event.type)

  function line() {
    switch (event.type) {
      case 'review.automated_started':
        return t('activity_modal.event.review.automated_started', {
          trigger: t(`activity_modal.trigger.${isValidationTrigger(payload.trigger) ? payload.trigger : 'publish'}`)
        })
      case 'review.automated_rejected':
        return t('activity_modal.event.review.automated_rejected', { count: countFailedItems(payload.items ?? []) })
      case 'review.automated_error':
        if (payload.reason === SWEEP_EXHAUSTED_REASON) return t('activity_modal.event.review.automated_error_exhausted')
        if (isTooLargeError(event)) return t('activity_modal.event.review.automated_error_too_large')
        return t(
          isCurator
            ? 'activity_modal.event.review.automated_error_curator'
            : 'activity_modal.event.review.automated_error'
        )
      case 'review.human_required':
        if (isUnsupportedItemsReview(event)) return t('activity_modal.event.review.human_required_unsupported')
        return t(
          payload.reason === VALIDATOR_ERROR_REASON
            ? 'activity_modal.event.review.human_required_validator_error'
            : 'activity_modal.event.review.human_required'
        )
      case 'review.assigned':
        return payload.assignee
          ? intl.formatMessage(
              { id: 'activity_modal.event.review.assigned' },
              { assignee: <AssigneeName key="assignee" address={payload.assignee} /> }
            )
          : t('activity_modal.event.review.unassigned')
      case 'changes.submitted':
        return t('activity_modal.event.changes.submitted', { count: payload.itemIds?.length ?? 0 })
      default:
        return known ? t(`activity_modal.event.${event.type}`) : t('activity_modal.event.unknown', { type: event.type })
    }
  }

  const actor =
    event.actorAddress && (event.actor === 'creator' || event.actor === 'curator') ? (
      <ProfileBadge address={event.actorAddress} testId="activity-actor" />
    ) : (
      <S.Actor data-testid="activity-actor">{t('activity_modal.actor.system')}</S.Actor>
    )
  const quote = payload.rejectionMessage ?? payload.message ?? payload.note
  const aboutItem = useMemo(
    () => (payload.itemId ? items.find(item => item.id === payload.itemId) : undefined),
    [payload.itemId, items]
  )

  return (
    <S.Row data-testid="activity-event" data-type={event.type}>
      <S.Line>
        {ACTOR_LED.has(event.type) && actor}
        <span data-testid="activity-line">{line()}</span>
      </S.Line>
      <S.Time
        dateTime={new Date(event.createdAt).toISOString()}
        title={intl.formatDate(event.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}
      >
        {formatTimeAgo(event.createdAt, intl.locale)}
      </S.Time>
      {(reasons.length > 0 || quote || failedItems.length > 0) && (
        <S.Details>
          {aboutItem && <S.ItemTag data-testid="activity-item">{aboutItem.name}</S.ItemTag>}
          {reasons.length > 0 && (
            <S.Reasons data-testid="activity-reasons">
              {reasons.map(code => (
                <S.Reason key={code}>{t(`reject_reason.${code}`)}</S.Reason>
              ))}
            </S.Reasons>
          )}
          {quote && <S.Quote data-testid="activity-quote">{quote}</S.Quote>}
          {failedItems.length > 0 && (
            <>
              <S.Toggle
                type="button"
                aria-expanded={showFindings}
                data-testid="activity-toggle-findings"
                onClick={() => setShowFindings(open => !open)}
              >
                {t(showFindings ? 'activity_modal.hide_findings' : 'activity_modal.show_findings')}
              </S.Toggle>
              {showFindings && (
                <ItemFindingsList
                  results={failedItems}
                  items={items}
                  showErrors={isCurator}
                  testId="activity-findings"
                />
              )}
            </>
          )}
        </S.Details>
      )}
    </S.Row>
  )
}

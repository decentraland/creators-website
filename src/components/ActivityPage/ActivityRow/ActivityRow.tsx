import { useMemo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useIntl } from 'react-intl'
import {
  Group as GroupIcon,
  LocalOffer as LocalOfferIcon,
  LockOpen as LockOpenIcon,
  OpenInNew as OpenInNewIcon,
  Publish as PublishIcon,
  RemoveShoppingCart as RemoveShoppingCartIcon,
  Send as SendIcon,
  Storefront as StorefrontIcon
} from '@mui/icons-material'
import { useTranslation } from '~/intl'
import { describeActivity, getTransactionUrl, type ActivityEvent, type ActivityEventType } from '~/lib/activity'
import { openExternal } from '~/lib/navigation'
import { formatTimeAgo } from '~/lib/time'
import * as S from './ActivityRow.styles'

const ICONS: Record<ActivityEventType, typeof PublishIcon> = {
  approve_mana: LockOpenIcon,
  publish_collection: PublishIcon,
  enable_sales: StorefrontIcon,
  set_roles: GroupIcon,
  send_items: SendIcon,
  remove_listing: RemoveShoppingCartIcon,
  update_price: LocalOfferIcon
}

type Props = {
  event: ActivityEvent
}

export function ActivityRow({ event }: Props) {
  const { t } = useTranslation()
  const intl = useIntl()
  const Icon = ICONS[event.type]
  const description = useMemo(() => describeActivity(event), [event])
  const explorerUrl = useMemo(() => getTransactionUrl(event.chainId, event.txHash), [event.chainId, event.txHash])

  const link = (chunks: ReactNode) =>
    event.collectionId ? (
      <Link to={`/collections/${event.collectionId}`} data-testid="activity-collection-link">
        {chunks}
      </Link>
    ) : (
      <strong>{chunks}</strong>
    )

  return (
    <S.Row data-testid="activity-row" data-status={event.status} data-type={event.type}>
      <S.Icon aria-hidden>
        <Icon fontSize="small" />
      </S.Icon>
      <S.Body>
        <S.Text data-testid="activity-text">
          {intl.formatMessage({ id: `activity_page.event.${description.key}` }, { ...description.values, link })}
        </S.Text>
        <S.Meta>
          <time dateTime={new Date(event.timestamp).toISOString()}>{formatTimeAgo(event.timestamp, intl.locale)}</time>
        </S.Meta>
      </S.Body>
      <S.Status data-status={event.status} data-testid="activity-status">
        {event.status === 'pending' && <S.Spinner aria-hidden />}
        {t(`activity_page.status.${event.status}`)}
      </S.Status>
      {explorerUrl && (
        <S.ExplorerButton
          type="button"
          aria-label={t('activity_page.view_transaction')}
          title={t('activity_page.view_transaction')}
          data-testid="activity-explorer"
          onClick={() => openExternal(explorerUrl)}
        >
          <OpenInNewIcon fontSize="small" />
        </S.ExplorerButton>
      )}
    </S.Row>
  )
}

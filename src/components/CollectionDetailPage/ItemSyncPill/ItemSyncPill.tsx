import { useTranslation } from '~/intl'
import { ItemSyncPill as Status } from '~/lib/itemSync'
import { Tooltip } from '~/components/Tooltip'
import * as S from './ItemSyncPill.styles'

type Props = {
  status: Status
  /** Offered on the states Publish changes fixes (modified, missing); the pill then opens that flow. */
  onPublishChanges?: () => void
}

const ACTIONABLE = new Set<Status>([Status.MODIFIED, Status.MISSING])

/** The item row's Status pill; every state but "published" explains itself in a tooltip. */
export function ItemSyncPill({ status, onPublishChanges }: Props) {
  const { t } = useTranslation()
  const clickable = !!onPublishChanges && ACTIONABLE.has(status)
  const hint = status === Status.PUBLISHED ? null : t(`collection_detail_page.item_status.${status}_hint`)
  const label = t(`collection_detail_page.item_status.${status}`)
  return (
    <Tooltip content={hint} asChild testId="item-sync-status-tooltip">
      {clickable ? (
        <S.PillButton type="button" data-testid="item-sync-status" data-status={status} onClick={onPublishChanges}>
          {label}
        </S.PillButton>
      ) : (
        <S.Pill data-testid="item-sync-status" data-status={status}>
          {label}
        </S.Pill>
      )}
    </Tooltip>
  )
}

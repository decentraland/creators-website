import { useTranslation } from '~/intl'
import { ItemSyncPill as Status } from '~/lib/itemSync'
import { InfoTooltip } from '~/components/Tooltip'
import * as S from './ItemSyncPill.styles'

type Props = {
  status: Status
}

/** The item row's Status pill; every state but "published" explains itself in an (i) tooltip. */
export function ItemSyncPill({ status }: Props) {
  const { t } = useTranslation()
  const hint = status === Status.PUBLISHED ? null : t(`collection_detail_page.item_status.${status}_hint`)
  return (
    <S.Pill data-testid="item-sync-status" data-status={status}>
      {t(`collection_detail_page.item_status.${status}`)}
      {hint && <InfoTooltip content={hint} testId="item-sync-status-hint" />}
    </S.Pill>
  )
}

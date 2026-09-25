import { useIntl } from 'react-intl'
import { Edit as EditIcon } from '@mui/icons-material'
import { useTranslation } from '~/intl'
import { CollectionMosaic } from '~/components/CollectionMosaic'
import { CurationStatePill } from '~/components/CurationStatePill'
import { ProfileBadge } from '~/components/ProfileBadge'
import { type Collection } from '~/lib/collections'
import { canEditAssignee, getCurationState, type CollectionCuration } from '~/lib/curation'
import { formatTimeAgo } from '~/lib/time'
import * as S from './CurationRow.styles'

type Props = {
  collection: Collection
  curation: CollectionCuration | null
  address: string
  onAssign: (collection: Collection, curation: CollectionCuration | null, mode: 'self' | 'edit') => void
}

export function reviewUrl(collection: Collection): string {
  return `/collections/editor?collection=${collection.id}&reviewing=true`
}

export function CurationRow({ collection, curation, address, onAssign }: Props) {
  const { t } = useTranslation()
  const intl = useIntl()
  const state = getCurationState(collection, curation)
  const assignee = curation?.assignee ?? null

  return (
    <S.Row data-testid="curation-row" data-state={state}>
      <S.NameCell>
        <S.Thumb>
          <CollectionMosaic collectionId={collection.id} itemCount={collection.itemCount} />
        </S.Thumb>
        <S.RowLink to={reviewUrl(collection)} data-testid="curation-row-link">
          <S.Name title={collection.name}>{collection.name}</S.Name>
          <S.Sub>{t('collections_page.item_count', { count: collection.itemCount })}</S.Sub>
        </S.RowLink>
      </S.NameCell>
      <S.Cell data-cell="owner">
        <ProfileBadge address={collection.owner} testId="curation-row-owner" />
      </S.Cell>
      <S.Cell data-cell="requested" data-testid="curation-row-requested">
        <S.CellLabel>{t(curation ? 'curation_page.list.requested' : 'curation_page.list.published')}</S.CellLabel>
        {formatTimeAgo(curation?.createdAt ?? collection.createdAt, intl.locale)}
      </S.Cell>
      <S.Cell data-cell="updated" data-testid="curation-row-updated">
        {curation ? formatTimeAgo(curation.updatedAt, intl.locale) : '—'}
      </S.Cell>
      <S.Cell data-cell="state">
        <CurationStatePill state={state} />
      </S.Cell>
      <S.AssigneeCell data-testid="curation-row-assignee">
        {assignee ? (
          <>
            <ProfileBadge address={assignee} self={assignee === address.toLowerCase()} testId="curation-row-curator" />
            {canEditAssignee(collection, curation) && (
              <S.IconAction
                type="button"
                aria-label={t('curation_page.list.edit_assignee')}
                data-testid="curation-row-edit-assignee"
                onClick={() => onAssign(collection, curation, 'edit')}
              >
                <EditIcon fontSize="small" />
              </S.IconAction>
            )}
          </>
        ) : (
          <>
            <S.Unassigned>{t('curation_page.list.unassigned')}</S.Unassigned>
            <S.TextAction
              type="button"
              data-testid="curation-row-assign-me"
              onClick={() => onAssign(collection, curation, 'self')}
            >
              {t('curation_page.list.assign_to_me')}
            </S.TextAction>
          </>
        )}
      </S.AssigneeCell>
    </S.Row>
  )
}

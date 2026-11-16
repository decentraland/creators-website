import { useIntl } from 'react-intl'
import { Link } from 'react-router-dom'
import { EditIcon } from '~/components/Icons'
import { useTranslation } from '~/intl'
import { CollectionMosaic } from '~/components/CollectionMosaic'
import { CurationStatePill } from '~/components/CurationStatePill'
import { ReviewTypePill } from '../ReviewTypePill'
import { ProfileBadge } from '~/components/ProfileBadge'
import { isLinkedCollection, type Collection } from '~/lib/collections'
import { openForumPost } from '~/lib/forumPost'
import { canEditAssignee, getCurationState, getReviewType, type CollectionCuration } from '~/lib/curation'
import { formatTimeAgo } from '~/lib/time'
import { cx } from '~/lib/cx'
import styles from './CurationRow.module.css'

type Props = {
  collection: Collection
  curation: CollectionCuration | null
  address: string
  onAssign: (collection: Collection, curation: CollectionCuration | null, mode: 'self' | 'edit') => void
}

function reviewUrl(collection: Collection): string {
  return `/collections/editor?collection=${collection.id}&reviewing=true`
}

export function CurationRow({ collection, curation, address, onAssign }: Props) {
  const { t } = useTranslation()
  const intl = useIntl()
  const state = getCurationState(collection, curation)
  const assignee = curation?.assignee ?? null
  const canAssign = canEditAssignee(collection, curation)

  return (
    <article className={styles.row} data-testid="curation-row" data-state={state}>
      <div className={styles.nameCell}>
        <div className={styles.thumb}>
          <CollectionMosaic collectionId={collection.id} itemCount={collection.itemCount} />
        </div>
        <Link className={styles.rowLink} to={reviewUrl(collection)} data-testid="curation-row-link">
          <h3 className={styles.name} title={collection.name}>
            {collection.name}
          </h3>
          <span className={styles.sub}>
            {t('collections_page.item_count', { count: collection.itemCount })}
            {isLinkedCollection(collection) && ` · ${t('collection_status.linked')}`}
          </span>
        </Link>
      </div>
      <div className={styles.cell} data-cell="owner">
        {collection.owner ? (
          <ProfileBadge address={collection.owner} testId="curation-row-owner" />
        ) : (
          // Linked collections belong to a third party, not a wallet.
          <span className={styles.unassigned} data-testid="curation-row-owner">
            {t('curation_page.list.third_party')}
          </span>
        )}
      </div>
      <div className={styles.cell} data-cell="requested" data-testid="curation-row-requested">
        <span className={styles.cellLabel}>
          {t(curation ? 'curation_page.list.requested' : 'curation_page.list.created')}
        </span>
        {formatTimeAgo(curation?.createdAt ?? collection.createdAt, intl.locale)}
      </div>
      <div className={styles.pills}>
        <div className={styles.cell} data-cell="type">
          <ReviewTypePill type={getReviewType(collection)} />
        </div>
        <div className={styles.cell} data-cell="state">
          <CurationStatePill state={state} />
        </div>
      </div>
      <div className={styles.discussionCell} data-testid="curation-row-discussion">
        <span className={styles.cellLabel} data-mobile-only>
          {t('curation_page.list.discussion')}
        </span>
        {collection.forumLink ? (
          <button
            className={cx(styles.textAction, styles.forumLink)}
            type="button"
            data-testid="curation-row-forum-link"
            onClick={() => openForumPost(collection, 'curation_list')}
          >
            {t('curation_page.list.forum_post')}
          </button>
        ) : (
          <span className={styles.unassigned}>{t('curation_page.list.not_posted')}</span>
        )}
      </div>
      <div
        className={styles.assigneeCell}
        data-testid="curation-row-assignee"
        data-unassigned={assignee ? undefined : ''}
      >
        {assignee ? (
          <>
            <ProfileBadge address={assignee} self={assignee === address.toLowerCase()} testId="curation-row-curator" />
            {canAssign && (
              <button
                className={styles.iconAction}
                type="button"
                aria-label={t('curation_page.list.edit_assignee')}
                data-testid="curation-row-edit-assignee"
                onClick={() => onAssign(collection, curation, 'edit')}
              >
                <EditIcon fontSize="small" />
              </button>
            )}
          </>
        ) : (
          <>
            <span className={styles.unassigned}>{t('curation_page.list.unassigned')}</span>
            {canAssign && (
              <button
                className={styles.textAction}
                type="button"
                data-testid="curation-row-assign-me"
                onClick={() => onAssign(collection, curation, 'self')}
              >
                {t('curation_page.list.assign_to_me')}
              </button>
            )}
          </>
        )}
      </div>
    </article>
  )
}

import { useEffect } from 'react'
import { useTranslation } from '~/intl'
import { Button } from '~/components/Button'
import { Modal } from '~/components/Modal'
import { useCollectionEvents } from '~/hooks/useCollectionEvents'
import { useCommittee } from '~/hooks/useCuration'
import { track } from '~/lib/analytics'
import { type Collection } from '~/lib/collections'
import { type Item } from '~/lib/items'
import { EventRow } from './EventRow'
import * as S from './CollectionActivityModal.styles'

type Props = {
  collection: Collection
  address: string
  /** The collection's items, when the caller has them, so findings show item names. */
  items?: Item[]
  onClose: () => void
}

/** The collection's review timeline, newest first, from Collection details → Actions → Activity. */
export function CollectionActivityModal({ collection, address, items = [], onClose }: Props) {
  const { t } = useTranslation()
  const { isCurator } = useCommittee(address)
  const query = useCollectionEvents(address, collection)
  const { isLoading, isAvailable, hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage, refetch } =
    query
  const events = query.events ?? []
  // A failed "Load more" keeps what is loaded on screen; only a failed first page empties the modal.
  const isError = query.isError && !isFetchNextPageError

  useEffect(() => {
    track('Open activity', { collectionId: collection.id })
  }, [collection.id])

  return (
    <Modal title={t('activity_modal.title')} onClose={onClose} size="large" testId="activity-modal">
      <S.Body>
        {isLoading ? (
          <S.Timeline aria-busy="true" data-testid="activity-loading">
            {Array.from({ length: 4 }, (_, i) => (
              <S.SkeletonRow key={i} className="skeleton" />
            ))}
          </S.Timeline>
        ) : isError ? (
          <>
            <S.State data-testid="activity-error">{t('activity_modal.error')}</S.State>
            <S.StateActions>
              <Button type="button" variant="secondary" onClick={() => void refetch()}>
                {t('activity_modal.retry')}
              </Button>
            </S.StateActions>
          </>
        ) : !isAvailable ? (
          <S.State data-testid="activity-unavailable">{t('activity_modal.unavailable')}</S.State>
        ) : events.length === 0 ? (
          <S.State data-testid="activity-empty">{t('activity_modal.empty')}</S.State>
        ) : (
          <>
            <S.Timeline data-testid="activity-timeline">
              {events.map(event => (
                <EventRow key={event.id} event={event} items={items} isCurator={isCurator} />
              ))}
            </S.Timeline>
            {isFetchNextPageError && (
              <S.State data-testid="activity-load-more-error">{t('activity_modal.error')}</S.State>
            )}
            {hasNextPage && (
              <S.More>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  loading={isFetchingNextPage}
                  data-testid="activity-load-more"
                  onClick={() => void fetchNextPage()}
                >
                  {t(isFetchNextPageError ? 'activity_modal.retry' : 'activity_modal.load_more')}
                </Button>
              </S.More>
            )}
          </>
        )}
      </S.Body>
    </Modal>
  )
}

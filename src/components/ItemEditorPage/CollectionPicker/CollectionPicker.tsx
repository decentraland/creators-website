import { useState } from 'react'
import { Search as SearchIcon } from '@mui/icons-material'
import { CollectionStatusPill } from '~/components/CollectionStatusPill'
import { Pagination } from '~/components/Pagination'
import { useTranslation } from '~/intl'
import { COLLECTIONS_PAGE_SIZE, useCollections } from '~/hooks/useCollections'
import { CollectionStatusFilter, type Collection } from '~/lib/collections'
import { SearchBox } from '~/styles/shared'
import * as S from '../ItemEditorPage.styles'
import * as Sidebar from '../ItemsSidebar/ItemsSidebar.styles'

type Props = {
  address: string
  onPick: (collection: Collection) => void
  testId?: string
}

/** Shown when the editor is opened without a collection: the signer's standard collections to choose from. */
export function CollectionPicker({ address, onPick, testId = 'collection-picker' }: Props) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const query = useCollections(address, { page, search, status: CollectionStatusFilter.ALL })
  const collections = query.data?.results ?? []
  const pages = query.data?.pages ?? 1

  return (
    <Sidebar.Wrap data-testid={testId}>
      <Sidebar.Header>
        <SearchBox style={{ width: '100%', height: 40 }}>
          <SearchIcon fontSize="small" />
          <input
            value={search}
            placeholder={t('item_editor.picker.search')}
            aria-label={t('item_editor.picker.search')}
            data-testid={`${testId}-search`}
            onChange={event => {
              setSearch(event.target.value)
              setPage(1)
            }}
          />
        </SearchBox>
      </Sidebar.Header>
      <Sidebar.List>
        {query.isLoading ? (
          <Sidebar.Rows aria-busy="true" data-testid={`${testId}-loading`}>
            {Array.from({ length: COLLECTIONS_PAGE_SIZE }, (_, index) => (
              <Sidebar.SkeletonRow key={index} className="skeleton" />
            ))}
          </Sidebar.Rows>
        ) : query.isError ? (
          <S.StateText data-testid={`${testId}-error`}>{t('item_editor.picker.error')}</S.StateText>
        ) : collections.length === 0 ? (
          <Sidebar.Empty data-testid={`${testId}-empty`}>{t('item_editor.picker.empty')}</Sidebar.Empty>
        ) : (
          <Sidebar.Rows>
            {collections.map(collection => (
              <Sidebar.Row key={collection.id} data-testid={`${testId}-row-${collection.id}`}>
                <Sidebar.RowButton
                  type="button"
                  data-testid={`${testId}-pick-${collection.id}`}
                  onClick={() => onPick(collection)}
                >
                  <Sidebar.RowName title={collection.name}>{collection.name}</Sidebar.RowName>
                  <CollectionStatusPill collection={collection} />
                </Sidebar.RowButton>
              </Sidebar.Row>
            ))}
          </Sidebar.Rows>
        )}
        {pages > 1 && <Pagination page={page} pages={pages} onPageChange={setPage} />}
      </Sidebar.List>
    </Sidebar.Wrap>
  )
}

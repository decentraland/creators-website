import { useState } from 'react'
import { Add as AddIcon, ArrowBackIosNew as BackIcon, Search as SearchIcon } from '@mui/icons-material'
import { Button } from '~/components/Button'
import { CollectionNameModal } from '~/components/CollectionNameModal'
import { CollectionStatusPill } from '~/components/CollectionStatusPill'
import { Pagination } from '~/components/Pagination'
import { useTranslation } from '~/intl'
import { useSaveCollection } from '~/hooks/useCollection'
import { useCollections } from '~/hooks/useCollections'
import { CollectionStatusFilter, type Collection } from '~/lib/collections'
import { buildNewCollection } from '~/lib/saveCollection'
import { SearchBox } from '~/styles/shared'
import * as S from '../ItemEditorPage.styles'
import * as Sidebar from '../ItemsSidebar/ItemsSidebar.styles'

// The picker's rows are shorter than the collections page's cards, so it fits more per page.
const PICKER_PAGE_SIZE = 12

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
  const [isCreateOpen, setCreateOpen] = useState(false)
  const saveCollection = useSaveCollection(address)
  const query = useCollections(address, {
    page,
    search,
    status: CollectionStatusFilter.ALL,
    limit: PICKER_PAGE_SIZE
  })
  const collections = query.data?.results ?? []
  const pages = query.data?.pages ?? 1

  function closeCreate() {
    setCreateOpen(false)
    saveCollection.reset()
  }

  return (
    <Sidebar.Wrap data-testid={testId}>
      <Sidebar.Header>
        <Sidebar.HeaderRow>
          <Sidebar.IconLink to="/collections" aria-label={t('item_editor.picker.back')} data-testid={`${testId}-back`}>
            <BackIcon fontSize="small" />
          </Sidebar.IconLink>
          <Sidebar.CollectionName>
            <Sidebar.CollectionTitle>{t('item_editor.picker.title')}</Sidebar.CollectionTitle>
          </Sidebar.CollectionName>
        </Sidebar.HeaderRow>
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
        <Button
          type="button"
          variant="secondary"
          size="sm"
          data-testid={`${testId}-create`}
          onClick={() => setCreateOpen(true)}
        >
          <AddIcon fontSize="small" />
          {t('item_editor.picker.create')}
        </Button>
      </Sidebar.Header>
      <Sidebar.List>
        {query.isLoading ? (
          <Sidebar.Rows aria-busy="true" data-testid={`${testId}-loading`}>
            {Array.from({ length: PICKER_PAGE_SIZE }, (_, index) => (
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
        {pages > 1 && (
          <Sidebar.PaginationWrap>
            <Pagination page={page} pages={pages} onPageChange={setPage} />
          </Sidebar.PaginationWrap>
        )}
      </Sidebar.List>
      {isCreateOpen && (
        <CollectionNameModal
          variant="create"
          isPending={saveCollection.isPending}
          error={saveCollection.error?.message ?? null}
          onSubmit={name =>
            saveCollection.mutate(buildNewCollection(name, address), {
              // A collection created here is the one the creator wants to fill: open it right away.
              onSuccess: created => {
                closeCreate()
                onPick(created)
              }
            })
          }
          onClose={closeCreate}
        />
      )}
    </Sidebar.Wrap>
  )
}

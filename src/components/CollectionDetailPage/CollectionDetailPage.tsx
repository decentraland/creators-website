import { useRef, useState, type DragEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Add as AddIcon,
  ArrowBackIosNew as ArrowBackIcon,
  Edit as EditIcon,
  MoreHoriz as MoreHorizIcon,
  PersonOutline as PersonOutlineIcon
} from '@mui/icons-material'
import { useIntl } from 'react-intl'
import { useTranslation } from '~/intl'
import { useWallet } from '~/store/wallet'
import { ITEMS_PAGE_SIZE, useCollection, useCollectionItems, useSaveCollection } from '~/hooks/useCollection'
import { BuilderServerError } from '~/lib/builder'
import { isCollectionLocked } from '~/lib/collections'
import { getCollectionPreviewUrl } from '~/lib/explorer'
import { pageRangeLabel } from '~/lib/pagination'
import { ITEM_EXTENSIONS } from '~/lib/itemFiles'
import { Button } from '~/components/Button'
import { JumpInIcon, OpenEditorIcon } from '~/components/Icons'
import { CollectionNameModal } from '~/components/CollectionNameModal'
import { CollectionStatusPill } from '~/components/CollectionStatusPill'
import { Pagination } from '~/components/Pagination'
import addItemsArt from '~/assets/add-items.png'
import { AddItemsModal } from './AddItemsModal'
import { ItemListRow } from './ItemListRow'
import * as S from './CollectionDetailPage.styles'

const NOT_FOUND_STATUSES = [401, 403, 404]

const CollectionDetailPage = () => {
  const { t } = useTranslation()
  const intl = useIntl()
  const navigate = useNavigate()
  const { collectionId } = useParams()
  const { session, restored, signIn } = useWallet()
  const address = session?.address

  const [searchParams, setSearchParams] = useSearchParams()
  const page = Math.max(1, Number(searchParams.get('page')) || 1)

  const [isRenameOpen, setRenameOpen] = useState(false)
  const [addItemsFiles, setAddItemsFiles] = useState<File[] | null>(null)
  const [isDragging, setDragging] = useState(false)
  const filesInputRef = useRef<HTMLInputElement>(null)

  const collectionQuery = useCollection(address, collectionId)
  const itemsQuery = useCollectionItems(address, collectionId, page)
  const saveCollection = useSaveCollection(address)

  const collection = collectionQuery.data
  const items = itemsQuery.data
  const total = items?.total ?? 0
  const pages = items?.pages ?? 0

  const results = items?.results ?? []

  const isLoading =
    !restored || (!!address && (collectionQuery.isLoading || (itemsQuery.isFetching && !items) || itemsQuery.isLoading))
  const isNotFound =
    collectionQuery.isError &&
    collectionQuery.error instanceof BuilderServerError &&
    NOT_FOUND_STATUSES.includes(collectionQuery.error.status)
  const isError = !isNotFound && (collectionQuery.isError || itemsQuery.isError)
  const isEmpty = !!collection && !!items && total === 0
  const hasItems = total > 0
  const canRename = !!collection && !collection.isPublished && !isCollectionLocked(collection)
  const canAddItems = canRename
  const canPublish = canRename && hasItems

  function openFileBrowser() {
    filesInputRef.current?.click()
  }

  function startAddItems(files: FileList | File[] | null) {
    const list = files ? Array.from(files) : []
    if (list.length > 0) setAddItemsFiles(list)
  }

  function onDropzoneDrop(event: DragEvent) {
    event.preventDefault()
    setDragging(false)
    if (canAddItems) startAddItems(event.dataTransfer.files)
  }

  function goToPage(next: number) {
    setSearchParams(
      prev => {
        const params = new URLSearchParams(prev)
        if (next > 1) params.set('page', String(next))
        else params.delete('page')
        return params
      },
      { replace: true }
    )
    window.scrollTo({ top: 0 })
  }

  function closeRenameModal() {
    setRenameOpen(false)
    saveCollection.reset()
  }

  function onRenameSubmit(name: string) {
    if (!collection || name === collection.name) {
      closeRenameModal()
      return
    }
    saveCollection.mutate({ ...collection, name }, { onSuccess: closeRenameModal })
  }

  return (
    <S.Page data-testid="collection-detail-page">
      {restored && !session ? (
        <S.Panel data-testid="sign-in-panel">
          <S.SignInIconWrap aria-hidden>
            <PersonOutlineIcon />
          </S.SignInIconWrap>
          <S.PanelTitle>{t('collection_detail_page.sign_in.title')}</S.PanelTitle>
          <Button type="button" variant="primary" data-testid="sign-in" onClick={() => signIn()}>
            {t('collection_detail_page.sign_in.action')}
          </Button>
        </S.Panel>
      ) : isLoading ? (
        <S.Loading aria-hidden data-testid="collection-detail-loading">
          <S.Header>
            <S.HeaderLeft>
              <S.SkeletonTitle className="skeleton" />
            </S.HeaderLeft>
            <S.HeaderActions>
              <S.SkeletonButton className="skeleton" />
              <S.SkeletonButton className="skeleton" />
              <S.SkeletonButton className="skeleton" data-icon />
            </S.HeaderActions>
          </S.Header>
          <S.SubHeader>
            <S.SkeletonLabel className="skeleton" />
            <S.SubActions>
              <S.SkeletonButton className="skeleton" data-compact />
              <S.SkeletonButton className="skeleton" data-compact />
            </S.SubActions>
          </S.SubHeader>
          <S.List>
            <S.SkeletonListHeader className="skeleton" />
            {Array.from({ length: 5 }, (_, i) => (
              <S.SkeletonRow key={i} className="skeleton" />
            ))}
          </S.List>
        </S.Loading>
      ) : isNotFound ? (
        <S.Panel data-testid="collection-not-found">
          <S.PanelTitle>{t('collection_detail_page.not_found.title')}</S.PanelTitle>
          <S.PanelText>{t('collection_detail_page.not_found.description')}</S.PanelText>
          <Button type="button" variant="secondary" onClick={() => navigate('/collections')}>
            {t('collection_detail_page.not_found.back')}
          </Button>
        </S.Panel>
      ) : isError || !collection ? (
        <S.Panel data-testid="collection-detail-error">
          <S.PanelTitle>{t('collection_detail_page.error.title')}</S.PanelTitle>
          <S.PanelText>{t('collection_detail_page.error.description')}</S.PanelText>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              void collectionQuery.refetch()
              void itemsQuery.refetch()
            }}
          >
            {t('collection_detail_page.error.retry')}
          </Button>
        </S.Panel>
      ) : (
        <>
          <S.Header>
            <S.HeaderLeft>
              <S.BackLink
                type="button"
                aria-label={t('collection_detail_page.back')}
                data-testid="back-to-collections"
                onClick={() => navigate('/collections')}
              >
                <ArrowBackIcon />
              </S.BackLink>
              <S.TitleGroup>
                <S.Title title={collection.name}>{collection.name}</S.Title>
                {canRename && (
                  <S.RenameButton
                    type="button"
                    aria-label={t('collection_detail_page.rename')}
                    data-testid="rename-collection"
                    onClick={() => setRenameOpen(true)}
                  >
                    <EditIcon fontSize="small" />
                  </S.RenameButton>
                )}
              </S.TitleGroup>
              <CollectionStatusPill collection={collection} />
            </S.HeaderLeft>
            <S.HeaderActions>
              <Button
                as="a"
                variant="dark"
                href={hasItems ? getCollectionPreviewUrl(collection.id) : undefined}
                target="_blank"
                rel="noopener noreferrer"
                aria-disabled={hasItems ? undefined : true}
                tabIndex={hasItems ? undefined : -1}
                data-testid="preview-collection"
              >
                {t('collection_detail_page.preview')}
                <JumpInIcon />
              </Button>
              {!collection.isPublished && (
                <Button
                  type="button"
                  variant="primary"
                  data-testid="publish-collection"
                  aria-disabled={canPublish ? undefined : true}
                  title={t('collection_detail_page.coming_soon')}
                >
                  {t('collection_detail_page.publish')}
                </Button>
              )}
              <Button
                variant="secondary"
                size="icon"
                type="button"
                aria-label={t('collection_detail_page.more_actions')}
                aria-disabled
                title={t('collection_detail_page.coming_soon')}
                data-testid="collection-actions"
              >
                <MoreHorizIcon />
              </Button>
            </S.HeaderActions>
          </S.Header>

          <S.SubHeader>
            <S.SectionLabel data-testid="items-count">
              {isEmpty
                ? t('collection_detail_page.no_items')
                : t('collection_detail_page.items_count', { count: total })}
            </S.SectionLabel>
            <S.SubActions>
              <Button
                variant="secondary"
                type="button"
                data-testid="open-editor"
                onClick={() => navigate(`/collections/editor?collection=${collection.id}`)}
              >
                <OpenEditorIcon />
                {t('collection_detail_page.open_editor')}
              </Button>
              {canAddItems && (
                <Button variant="secondary" type="button" data-testid="add-items" onClick={openFileBrowser}>
                  <AddIcon fontSize="small" />
                  {t('collection_detail_page.add_items')}
                </Button>
              )}
            </S.SubActions>
          </S.SubHeader>

          {isEmpty ? (
            <>
              <S.Dropzone
                data-testid="collection-empty"
                data-dragging={isDragging || undefined}
                onDragOver={event => {
                  event.preventDefault()
                  if (canAddItems) setDragging(true)
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDropzoneDrop}
              >
                <S.DropArt src={addItemsArt} alt="" />
                <S.DropTitle data-desktop>{t('collection_detail_page.empty.title')}</S.DropTitle>
                <S.DropTitle data-mobile>{t('collection_detail_page.empty.title_mobile')}</S.DropTitle>
                <S.DropText data-desktop>
                  {intl.formatMessage(
                    { id: 'collection_detail_page.empty.description' },
                    {
                      browse: chunks => (
                        <S.BrowseLink type="button" data-testid="browse-files" onClick={openFileBrowser}>
                          {chunks}
                        </S.BrowseLink>
                      )
                    }
                  )}
                </S.DropText>
                <S.DropText data-mobile>{t('collection_detail_page.empty.description_mobile')}</S.DropText>
                <S.DropFormats>{t('collection_detail_page.empty.formats')}</S.DropFormats>
              </S.Dropzone>
            </>
          ) : (
            <>
              <S.List data-testid="items-list">
                <S.ListHeader>
                  <span>{t('collection_detail_page.list.item')}</span>
                  <span>{t('collection_detail_page.list.body_type')}</span>
                  <span>{t('collection_detail_page.list.rarity')}</span>
                  <span>{t('collection_detail_page.list.category')}</span>
                  <span>{t('collection_detail_page.list.status')}</span>
                  <S.ListHeaderActions>{t('collection_detail_page.list.actions')}</S.ListHeaderActions>
                </S.ListHeader>
                {results.map(item => (
                  <ItemListRow key={item.id} item={item} />
                ))}
              </S.List>
              <S.FooterRow>
                <S.ShowingCount data-testid="items-showing">
                  {t('collection_detail_page.showing', {
                    range: pageRangeLabel(page, ITEMS_PAGE_SIZE, results.length),
                    total
                  })}
                </S.ShowingCount>
                {pages > 1 && <Pagination page={page} pages={pages} onPageChange={goToPage} />}
              </S.FooterRow>
            </>
          )}

          {isRenameOpen && (
            <CollectionNameModal
              variant="rename"
              initialName={collection.name}
              isPending={saveCollection.isPending}
              error={saveCollection.error?.message ?? null}
              onSubmit={onRenameSubmit}
              onClose={closeRenameModal}
            />
          )}

          <input
            ref={filesInputRef}
            type="file"
            multiple
            accept={ITEM_EXTENSIONS.join(',')}
            hidden
            data-testid="add-items-input"
            onChange={event => {
              startAddItems(event.target.files)
              event.target.value = ''
            }}
          />

          {addItemsFiles && address && (
            <AddItemsModal
              collection={collection}
              address={address}
              files={addItemsFiles}
              onClose={() => setAddItemsFiles(null)}
            />
          )}
        </>
      )}
    </S.Page>
  )
}

export { CollectionDetailPage }

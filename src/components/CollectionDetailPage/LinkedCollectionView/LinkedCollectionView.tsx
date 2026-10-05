import { useEffect, useMemo, useRef } from 'react'
import { ContractNetwork } from '@dcl/schemas'
import {
  ArrowBackIosNew as ArrowBackIcon,
  ContentCopy as ContentCopyIcon,
  OpenInNew as OpenInNewIcon
} from '@mui/icons-material'
import { useTranslation } from '~/intl'
import { track } from '~/lib/analytics'
import { getContentsStorageUrl } from '~/lib/builder'
import { shortenAddress } from '~/lib/address'
import { copyToClipboard } from '~/lib/clipboard'
import { type Collection } from '~/lib/collections'
import { paginateItems } from '~/lib/itemFilters'
import { type Item } from '~/lib/items'
import { builderLinkedCollectionUrl, getLinkedItemStatus, getMappingLabel } from '~/lib/linkedCollections'
import { openExternal } from '~/lib/navigation'
import { useNotifications } from '~/lib/notifications'
import { pageRangeLabel } from '~/lib/pagination'
import { useItemCurations } from '~/hooks/useLinkedCollection'
import { ITEMS_PAGE_SIZE } from '~/hooks/useCollection'
import { Button } from '~/components/Button'
import { CollectionStatusPill } from '~/components/CollectionStatusPill'
import { CategoryIcon } from '~/components/ItemIcons'
import { ItemThumbnail } from '~/components/ItemThumbnail'
import { Pagination } from '~/components/Pagination'
import { Pill } from '~/components/CollectionStatusPill/CollectionStatusPill.styles'
import * as P from '../CollectionDetailPage.styles'
import * as R from '../ItemListRow/ItemListRow.styles'
import * as S from './LinkedCollectionView.styles'

const EMPTY = '—'
const NETWORKS: string[] = Object.values(ContractNetwork)

type Props = {
  collection: Collection
  thirdPartyName?: string
  items: Item[]
  address: string
  page: number
  onBack: () => void
  onPageChange: (page: number) => void
}

/** A linked (third-party) collection, read-only: its contract, items, their curation and token mapping. */
export function LinkedCollectionView({
  collection,
  thirdPartyName,
  items,
  address,
  page,
  onBack,
  onPageChange
}: Props) {
  const { t } = useTranslation()
  const showToast = useNotifications(state => state.showToast)
  const curations = useItemCurations(address, collection)

  const { results, total, pages } = useMemo(() => paginateItems(items, page, ITEMS_PAGE_SIZE), [items, page])
  const network = collection.linkedContractNetwork
  const contractAddress = collection.linkedContractAddress

  const tracked = useRef(false)
  useEffect(() => {
    if (tracked.current) return
    tracked.current = true
    track('View linked collection', { collectionId: collection.id, item_count: items.length, network })
  }, [collection.id, items.length, network])

  async function copyContract() {
    if (!contractAddress) return
    track('Copy linked contract address', { collectionId: collection.id, network })
    if (await copyToClipboard(contractAddress)) showToast(t('linked_collection.contract_copied'))
    else showToast(t('collection_detail_page.actions.copy_failed'), { type: 'error' })
  }

  return (
    <>
      <P.Header>
        <P.HeaderLeft>
          <P.BackLink
            type="button"
            aria-label={t('collection_detail_page.back')}
            data-testid="back-to-collections"
            onClick={onBack}
          >
            <ArrowBackIcon />
          </P.BackLink>
          <P.TitleGroup>
            <P.Title title={collection.name}>{collection.name}</P.Title>
          </P.TitleGroup>
          <CollectionStatusPill collection={collection} />
        </P.HeaderLeft>
        <P.HeaderActions>
          <Button
            type="button"
            variant="secondary"
            data-desktop-only
            data-testid="edit-in-builder"
            onClick={() => {
              track('Edit linked collection in builder', { collectionId: collection.id, source: 'detail' })
              openExternal(builderLinkedCollectionUrl(collection.id))
            }}
          >
            {t('linked_collection.edit_in_builder')}
            <OpenInNewIcon fontSize="small" aria-hidden />
          </Button>
        </P.HeaderActions>
      </P.Header>

      <S.ContractRow data-testid="linked-contract">
        {thirdPartyName && (
          <S.ContractField>
            <S.ContractLabel>{t('linked_collection.third_party')}</S.ContractLabel>
            <S.ContractValue data-testid="linked-third-party">{thirdPartyName}</S.ContractValue>
          </S.ContractField>
        )}
        {network && (
          <S.ContractField>
            <S.ContractLabel>{t('linked_collection.network')}</S.ContractLabel>
            <S.ContractValue data-testid="linked-network">
              {NETWORKS.includes(network) ? t(`linked_collection.networks.${network}`) : network}
            </S.ContractValue>
          </S.ContractField>
        )}
        {contractAddress && (
          <S.ContractField>
            <S.ContractLabel>{t('linked_collection.contract')}</S.ContractLabel>
            <S.ContractValue data-testid="linked-contract-address" title={contractAddress}>
              {shortenAddress(contractAddress)}
              <S.CopyButton
                type="button"
                aria-label={t('linked_collection.copy_contract')}
                data-testid="copy-linked-contract"
                onClick={() => void copyContract()}
              >
                <ContentCopyIcon fontSize="small" />
              </S.CopyButton>
            </S.ContractValue>
          </S.ContractField>
        )}
      </S.ContractRow>

      <P.SubHeader>
        {/* Linked collections hold wearables only, so there is nothing to filter by type. */}
        <S.ItemCount data-testid="linked-item-count">
          {t('collections_page.item_count', { count: items.length })}
        </S.ItemCount>
      </P.SubHeader>

      {total === 0 ? (
        <P.Panel data-testid="collection-no-items">
          <P.PanelTitle>{t('collection_detail_page.no_items.all')}</P.PanelTitle>
          <P.PanelText>{t('linked_collection.no_items')}</P.PanelText>
        </P.Panel>
      ) : (
        <>
          <P.List data-testid="items-list">
            <P.ListHeader>
              <span>{t('collection_detail_page.list.item')}</span>
              <span>{t('collection_detail_page.list.category')}</span>
              <span>{t('linked_collection.list.status')}</span>
              <span>{t('linked_collection.list.mapping')}</span>
            </P.ListHeader>
            {results.map(item => {
              const thumbnailHash = item.contents[item.thumbnail]
              const category = item.data.category
              const status = curations.isSuccess ? getLinkedItemStatus(curations.data.get(item.id)) : undefined
              const mapping = getMappingLabel(item.mappings, network, contractAddress)
              return (
                <R.Row key={item.id} data-testid="linked-item-row">
                  <R.Thumb>
                    <ItemThumbnail
                      src={thumbnailHash ? getContentsStorageUrl(thumbnailHash) : null}
                      rarity={item.rarity}
                    />
                  </R.Thumb>
                  <R.Content>
                    <R.Name>
                      <R.NameText data-testid="item-row-name" title={item.name}>
                        {item.name}
                      </R.NameText>
                    </R.Name>
                    <R.Cell data-testid="item-row-category">
                      {category ? <CategoryIcon category={category} withLabel /> : EMPTY}
                    </R.Cell>
                    <R.Cell data-testid="linked-item-status-cell">
                      {status ? (
                        <Pill data-testid="linked-item-status" data-status={status}>
                          {t(`linked_collection.item_status.${status}`)}
                        </Pill>
                      ) : (
                        EMPTY
                      )}
                    </R.Cell>
                    <R.Cell data-testid="linked-item-mapping">{t(mapping.id, mapping.values)}</R.Cell>
                  </R.Content>
                </R.Row>
              )
            })}
          </P.List>
          <P.FooterRow>
            <P.ShowingCount data-testid="items-showing">
              {t('collection_detail_page.showing', {
                range: pageRangeLabel(page, ITEMS_PAGE_SIZE, results.length),
                total
              })}
            </P.ShowingCount>
            {pages > 1 && <Pagination page={page} pages={pages} onPageChange={onPageChange} />}
          </P.FooterRow>
        </>
      )}
    </>
  )
}

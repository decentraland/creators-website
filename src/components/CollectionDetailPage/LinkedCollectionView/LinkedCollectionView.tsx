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
import { copyToClipboard } from '~/lib/clipboard'
import { type Collection } from '~/lib/collections'
import {
  ITEM_TYPE_FILTERS,
  ItemTypeFilter,
  countItemsByType,
  filterItemsByType,
  paginateItems
} from '~/lib/itemFilters'
import { type Item } from '~/lib/items'
import {
  builderLinkedCollectionUrl,
  getLinkedItemStatus,
  summarizeMapping,
  type MappingSummary
} from '~/lib/linkedCollections'
import { openExternal } from '~/lib/navigation'
import { useNotifications } from '~/lib/notifications'
import { pageRangeLabel } from '~/lib/pagination'
import { useItemCurations } from '~/hooks/useLinkedCollection'
import { ITEMS_PAGE_SIZE } from '~/hooks/useCollection'
import { Button } from '~/components/Button'
import { CollectionStatusPill } from '~/components/CollectionStatusPill'
import { EmoteIcon, WearableIcon } from '~/components/Icons'
import { CategoryIcon } from '~/components/ItemIcons'
import { ItemThumbnail } from '~/components/ItemThumbnail'
import { Pagination } from '~/components/Pagination'
import * as P from '../CollectionDetailPage.styles'
import * as S from './LinkedCollectionView.styles'

const EMPTY = '—'
const NETWORKS: string[] = Object.values(ContractNetwork)

const shortenAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`

type Props = {
  collection: Collection
  thirdPartyName?: string
  items: Item[]
  address: string
  page: number
  typeFilter: ItemTypeFilter
  onBack: () => void
  onTypeFilterChange: (filter: ItemTypeFilter) => void
  onPageChange: (page: number) => void
}

/** A linked (third-party) collection, read-only: its contract, items, their curation and token mapping. */
export function LinkedCollectionView({
  collection,
  thirdPartyName,
  items,
  address,
  page,
  typeFilter,
  onBack,
  onTypeFilterChange,
  onPageChange
}: Props) {
  const { t } = useTranslation()
  const showToast = useNotifications(state => state.showToast)
  const curations = useItemCurations(address, collection)

  const counts = useMemo(() => countItemsByType(items), [items])
  const { results, total, pages } = useMemo(
    () => paginateItems(filterItemsByType(items, typeFilter), page, ITEMS_PAGE_SIZE),
    [items, typeFilter, page]
  )
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

  function mappingLabel(summary: MappingSummary): string {
    switch (summary.kind) {
      case 'any':
        return t('linked_collection.mapping.any')
      case 'single':
        return t('linked_collection.mapping.single', { id: summary.id })
      case 'range':
        return t('linked_collection.mapping.range', { from: summary.from, to: summary.to })
      case 'multiple':
        return t('linked_collection.mapping.multiple', { count: summary.count })
      case 'rules':
        return t('linked_collection.mapping.rules', { count: summary.count })
      default:
        return t('linked_collection.mapping.none')
    }
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
        <P.FilterChips data-testid="type-filters">
          {ITEM_TYPE_FILTERS.map(filter => (
            <P.FilterChip
              key={filter}
              type="button"
              data-active={typeFilter === filter || undefined}
              data-testid={`type-filter-${filter}`}
              onClick={() => onTypeFilterChange(filter)}
            >
              {filter === ItemTypeFilter.WEARABLE && <WearableIcon />}
              {filter === ItemTypeFilter.EMOTE && <EmoteIcon />}
              {t(`collection_detail_page.filter.${filter}`, { count: counts[filter] })}
            </P.FilterChip>
          ))}
        </P.FilterChips>
      </P.SubHeader>

      {total === 0 ? (
        <P.Panel data-testid="collection-no-items">
          <P.PanelTitle>{t(`collection_detail_page.no_items.${typeFilter}`)}</P.PanelTitle>
          <P.PanelText>{t('linked_collection.no_items')}</P.PanelText>
        </P.Panel>
      ) : (
        <>
          <S.List data-testid="items-list">
            <S.ListHeader>
              <span>{t('collection_detail_page.list.item')}</span>
              <span>{t('collection_detail_page.list.category')}</span>
              <span>{t('linked_collection.list.status')}</span>
              <span>{t('linked_collection.list.mapping')}</span>
            </S.ListHeader>
            {results.map(item => {
              const thumbnailHash = item.contents[item.thumbnail]
              const category = item.data.category
              const status = curations.isSuccess ? getLinkedItemStatus(curations.data.get(item.id)) : undefined
              return (
                <S.Row key={item.id} data-testid="linked-item-row">
                  <S.Thumb>
                    <ItemThumbnail
                      src={thumbnailHash ? getContentsStorageUrl(thumbnailHash) : null}
                      rarity={item.rarity}
                    />
                  </S.Thumb>
                  <S.Content>
                    <S.Name data-testid="item-row-name" title={item.name}>
                      {item.name}
                    </S.Name>
                    <S.Cell data-testid="item-row-category">
                      {category ? <CategoryIcon category={category} withLabel /> : EMPTY}
                    </S.Cell>
                    <S.Cell data-testid="linked-item-status-cell">
                      {status ? (
                        <S.ItemStatus data-testid="linked-item-status" data-status={status}>
                          {t(`linked_collection.item_status.${status}`)}
                        </S.ItemStatus>
                      ) : (
                        EMPTY
                      )}
                    </S.Cell>
                    <S.Cell data-testid="linked-item-mapping">
                      {mappingLabel(summarizeMapping(item.mappings, network, contractAddress))}
                    </S.Cell>
                  </S.Content>
                </S.Row>
              )
            })}
          </S.List>
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

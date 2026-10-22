import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from '~/intl'
import { getContentsStorageUrl } from '~/lib/builder'
import { type Item } from '~/lib/items'
import { type LinkedItemStatus } from '~/lib/linkedItemStatus'
import { areMappingsEqual, buildItemMappings, getItemMapping, type Mapping, type Mappings } from '~/lib/mappings'
import { type LinkedContract } from '~/lib/thirdParty'
import { CategoryIcon } from '~/components/ItemIcons'
import { ItemThumbnail } from '~/components/ItemThumbnail'
import { MappingEditor } from '~/components/MappingEditor'
import { Pill } from '~/components/CollectionStatusPill/CollectionStatusPill.styles'
import * as R from '../ItemListRow/ItemListRow.styles'
import * as S from './LinkedCollectionView.styles'

const EMPTY = '—'
const MAPPING_SAVE_DEBOUNCE_MS = 1000

type Props = {
  item: Item
  contract: LinkedContract | null
  /** The row's status; undefined while the item's curation is still loading. */
  status: LinkedItemStatus | undefined
  /** Whether the row can be selected for publishing; its checkbox is otherwise disabled. */
  selectable: boolean
  selected: boolean
  onSelectedChange: (selected: boolean) => void
  /** Whether the viewer may edit the mapping in place (desktop managers). */
  editable: boolean
  /** Saves a new mapping; a rejected promise keeps the row's draft so the creator can retry. */
  onSaveMappings: (item: Item, mappings: Mappings) => Promise<unknown>
  actions?: ReactNode
}

/** A linked item: thumbnail, name, category, review status and the token mapping that unlocks it. */
export function LinkedItemRow({
  item,
  contract,
  status,
  selectable,
  selected,
  onSelectedChange,
  editable,
  onSaveMappings,
  actions
}: Props) {
  const { t } = useTranslation()
  const thumbnailHash = item.contents[item.thumbnail]
  const category = item.data.category
  const mapping = getItemMapping(item.mappings, contract)
  const [isSaving, setSaving] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  // The edit waiting for the pause, so leaving the row (page, filter, editor) saves it instead of dropping it.
  const pending = useRef<Mappings | null>(null)
  const latest = useRef({ item, onSaveMappings })
  latest.current = { item, onSaveMappings }

  const flush = useCallback(() => {
    clearTimeout(timer.current)
    const mappings = pending.current
    pending.current = null
    if (!mappings) return
    setSaving(true)
    latest.current
      .onSaveMappings(latest.current.item, mappings)
      .catch(() => undefined)
      .finally(() => setSaving(false))
  }, [])

  useEffect(
    () => () => {
      clearTimeout(timer.current)
      const mappings = pending.current
      if (mappings) void latest.current.onSaveMappings(latest.current.item, mappings).catch(() => undefined)
    },
    []
  )

  // A valid change saves itself after a pause, like the legacy row: no save button per mapping.
  function onMappingChange(next: Mapping | null) {
    clearTimeout(timer.current)
    pending.current = null
    if (!next || !contract) return
    const mappings = buildItemMappings(next, contract)
    if (areMappingsEqual(mappings, item.mappings)) return
    pending.current = mappings
    timer.current = setTimeout(flush, MAPPING_SAVE_DEBOUNCE_MS)
  }

  return (
    <S.Row data-testid="linked-item-row" data-selected={selected || undefined}>
      <S.SelectCell>
        <input
          type="checkbox"
          checked={selected}
          disabled={!selectable}
          aria-label={t('linked_collection.select_item', { name: item.name })}
          data-testid="linked-item-select"
          onChange={event => onSelectedChange(event.target.checked)}
        />
      </S.SelectCell>
      <R.Thumb>
        <ItemThumbnail src={thumbnailHash ? getContentsStorageUrl(thumbnailHash) : null} rarity={item.rarity} />
      </R.Thumb>
      <S.NameCell>
        <R.NameText data-testid="item-row-name" title={item.name}>
          {item.name}
        </R.NameText>
        {item.urn && (
          <S.Urn title={item.urn} data-testid="linked-item-urn">
            {item.urn.split(':').pop()}
          </S.Urn>
        )}
      </S.NameCell>
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
      <S.MappingCell data-testid="linked-item-mapping" data-saving={isSaving || undefined}>
        {contract ? (
          <MappingEditor
            value={mapping}
            compact
            withHelp={false}
            disabled={!editable}
            testId="linked-item-mapping-editor"
            onChange={onMappingChange}
          />
        ) : (
          t('linked_collection.mapping.none')
        )}
        {isSaving && <R.Spinner data-testid="linked-item-mapping-saving" aria-hidden />}
      </S.MappingCell>
      <R.ActionsCell>{actions}</R.ActionsCell>
    </S.Row>
  )
}

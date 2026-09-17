import { useMemo, useRef } from 'react'
import { type BodyShape } from '@dcl/schemas'
import {
  Add as AddIcon,
  ArrowBackIosNew as BackIcon,
  GraphicEq as PlayingIcon,
  KeyboardDoubleArrowLeft as CollapseIcon,
  KeyboardDoubleArrowRight as ExpandIcon,
  Edit as EditIcon,
  Visibility as DressedIcon,
  VisibilityOff as UndressedIcon
} from '@mui/icons-material'
import { Button } from '~/components/Button'
import { CollectionStatusPill } from '~/components/CollectionStatusPill'
import { EmoteIcon, WearableIcon } from '~/components/Icons'
import { ItemThumbnail } from '~/components/ItemThumbnail'
import { Tooltip } from '~/components/Tooltip'
import { useScrollFades } from '~/hooks/useScrollFades'
import { useTranslation } from '~/intl'
import { getContentsStorageUrl } from '~/lib/builder'
import { type Collection } from '~/lib/collections'
import { groupItemsByType, hasRepresentationFor, type EditorMode } from '~/lib/itemEditor'
import { ItemType, type Item } from '~/lib/items'
import { EditorSection } from '../EditorSection'
import * as S from './ItemsSidebar.styles'

type Props = {
  collection: Collection
  items: Item[]
  isLoading: boolean
  selectedId: string | null
  dressedIds: string[]
  bodyShape: BodyShape
  isPlaying: boolean
  mode: EditorMode
  /** Narrow mode: thumbnails and icons only; the width animates between the two. */
  collapsed: boolean
  onToggleCollapsed: () => void
  /** Draft collections only; opens the add-items file picker. */
  canAddItems: boolean
  onAddItems: () => void
  /** Draft collections the viewer manages: a pencil next to the name opens the rename dialog. */
  onRename?: () => void
  onSelect: (item: Item) => void
  onToggleDressed: (item: Item) => void
  /** Clicking the selected, dressed emote row toggles its playback. */
  onToggleEmotePlay: (item: Item) => void
  testId?: string
}

export function ItemsSidebar({
  collection,
  items,
  isLoading,
  selectedId,
  dressedIds,
  bodyShape,
  isPlaying,
  mode,
  collapsed,
  onToggleCollapsed,
  canAddItems,
  onAddItems,
  onRename,
  onSelect,
  onToggleDressed,
  onToggleEmotePlay,
  testId = 'items-sidebar'
}: Props) {
  const { t } = useTranslation()
  const listRef = useRef<HTMLDivElement>(null)
  useScrollFades(listRef, 'y')
  const groups = useMemo(() => groupItemsByType(items), [items])
  const grouped = groups.wearables.length > 0 && groups.emotes.length > 0
  const backTo = mode === 'review' ? '/curation' : `/collections/${collection.id}`
  const showAddItems = mode === 'edit' && canAddItems

  function onRowClick(item: Item) {
    if (item.type === ItemType.EMOTE && item.id === selectedId && dressedIds.includes(item.id)) {
      onToggleEmotePlay(item)
      return
    }
    onSelect(item)
  }

  function renderRow(item: Item) {
    const available = hasRepresentationFor(item, bodyShape)
    const dressed = dressedIds.includes(item.id)
    const thumbnail = item.contents[item.thumbnail]
    const playing = item.type === ItemType.EMOTE && dressed && isPlaying
    const row = (
      <S.Row
        key={item.id}
        data-testid={`${testId}-row-${item.id}`}
        data-selected={item.id === selectedId || undefined}
        data-dressed={dressed || undefined}
        data-unavailable={!available || undefined}
      >
        <S.RowButton
          type="button"
          aria-current={item.id === selectedId || undefined}
          aria-label={collapsed ? item.name : undefined}
          data-testid={`${testId}-select-${item.id}`}
          onClick={() => onRowClick(item)}
        >
          <S.Thumb data-dressed={dressed || undefined}>
            <ItemThumbnail src={thumbnail ? getContentsStorageUrl(thumbnail) : null} rarity={item.rarity} />
          </S.Thumb>
          <S.RowName title={item.name}>{item.name}</S.RowName>
          {playing && (
            <S.RowGlyph data-playing data-testid={`${testId}-playing-${item.id}`}>
              <PlayingIcon />
            </S.RowGlyph>
          )}
        </S.RowButton>
        <S.DressButton
          type="button"
          aria-pressed={dressed}
          aria-label={t(dressed ? 'item_editor.sidebar.undress' : 'item_editor.sidebar.dress', { name: item.name })}
          disabled={!available}
          data-testid={`${testId}-dress-${item.id}`}
          onClick={() => onToggleDressed(item)}
        >
          {dressed ? <DressedIcon fontSize="small" /> : <UndressedIcon fontSize="small" />}
        </S.DressButton>
      </S.Row>
    )
    // Collapsed rows have no visible name, so the tooltip carries it (and the body-shape note when relevant).
    const note = available ? null : t('item_editor.sidebar.no_representation')
    const content = collapsed ? (note ? `${item.name} · ${note}` : item.name) : note
    if (content === null) return row
    return (
      <Tooltip
        key={item.id}
        content={content}
        placement={collapsed ? 'right' : 'top'}
        asChild
        testId={available ? `${testId}-name-tooltip` : `${testId}-unavailable`}
      >
        {row}
      </Tooltip>
    )
  }

  function renderGroup(kind: 'wearables' | 'emotes', groupItems: Item[]) {
    return (
      <EditorSection
        title={t(`item_editor.sidebar.${kind}`)}
        icon={kind === 'wearables' ? <WearableIcon /> : <EmoteIcon />}
        iconOnly={collapsed}
        testId={`${testId}-${kind}`}
      >
        <S.Rows>{groupItems.map(renderRow)}</S.Rows>
      </EditorSection>
    )
  }

  const toggleLabel = t(collapsed ? 'item_editor.sidebar.expand' : 'item_editor.sidebar.collapse')

  return (
    <S.Shell>
      <S.Wrap data-testid={testId} data-collapsed={collapsed || undefined}>
        <S.Header>
          <S.HeaderRow>
            <Tooltip
              content={t('item_editor.sidebar.back')}
              placement="right"
              asChild
              testId={`${testId}-back-tooltip`}
            >
              <S.IconLink to={backTo} aria-label={t('item_editor.sidebar.back')} data-testid={`${testId}-back`}>
                <BackIcon fontSize="small" />
              </S.IconLink>
            </Tooltip>
            <S.CollectionName>
              <S.TitleGroup>
                <S.CollectionTitle title={collection.name} data-testid={`${testId}-collection`}>
                  {collection.name}
                </S.CollectionTitle>
                {mode === 'edit' && onRename && (
                  <S.RenameButton
                    type="button"
                    aria-label={t('collection_detail_page.rename')}
                    data-testid={`${testId}-rename`}
                    onClick={onRename}
                  >
                    <EditIcon />
                  </S.RenameButton>
                )}
              </S.TitleGroup>
              <CollectionStatusPill collection={collection} />
            </S.CollectionName>
          </S.HeaderRow>
          {showAddItems && (
            <S.HeaderMeta>
              {collapsed ? (
                <Tooltip
                  content={t('item_editor.sidebar.add_items')}
                  placement="right"
                  asChild
                  testId={`${testId}-add-items-tooltip`}
                >
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    aria-label={t('item_editor.sidebar.add_items')}
                    data-testid={`${testId}-add-items`}
                    onClick={onAddItems}
                  >
                    <AddIcon fontSize="small" />
                  </Button>
                </Tooltip>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  data-testid={`${testId}-add-items`}
                  onClick={onAddItems}
                >
                  <AddIcon fontSize="small" />
                  {t('item_editor.sidebar.add_items')}
                </Button>
              )}
            </S.HeaderMeta>
          )}
        </S.Header>
        <S.List ref={listRef}>
          {isLoading ? (
            <S.Rows aria-busy="true" data-testid={`${testId}-loading`}>
              {Array.from({ length: 5 }, (_, index) => (
                <S.SkeletonRow key={index} className="skeleton" />
              ))}
            </S.Rows>
          ) : items.length === 0 ? (
            !collapsed && <S.Empty data-testid={`${testId}-empty`}>{t('item_editor.sidebar.empty')}</S.Empty>
          ) : grouped ? (
            <>
              {renderGroup('wearables', groups.wearables)}
              {renderGroup('emotes', groups.emotes)}
            </>
          ) : (
            <S.Rows>{items.map(renderRow)}</S.Rows>
          )}
        </S.List>
      </S.Wrap>
      {/* Half outside the panel edge, level with the back button, so it reads as the panel's own handle. */}
      <Tooltip content={toggleLabel} placement="right" asChild testId={`${testId}-toggle-tooltip`}>
        <S.FloatingToggle
          type="button"
          aria-label={toggleLabel}
          aria-expanded={!collapsed}
          data-testid={`${testId}-toggle`}
          onClick={onToggleCollapsed}
        >
          {collapsed ? <ExpandIcon fontSize="small" /> : <CollapseIcon fontSize="small" />}
        </S.FloatingToggle>
      </Tooltip>
    </S.Shell>
  )
}

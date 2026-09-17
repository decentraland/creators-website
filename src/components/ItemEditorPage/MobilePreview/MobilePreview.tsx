import { useState, type ReactNode } from 'react'
import { type BodyShape } from '@dcl/schemas'
import { Close as CloseIcon, DesktopWindowsOutlined as DesktopIcon } from '@mui/icons-material'
import { ItemThumbnail } from '~/components/ItemThumbnail'
import { useTranslation } from '~/intl'
import { getContentsStorageUrl } from '~/lib/builder'
import { hasRepresentationFor } from '~/lib/itemEditor'
import { type Item } from '~/lib/items'
import * as S from '../ItemEditorPage.styles'

type Props = {
  items: Item[]
  selectedId: string | null
  dressedIds: string[]
  bodyShape: BodyShape
  onSelect: (item: Item) => void
  /** The avatar preview with its overlay controls. */
  children: ReactNode
}

/** Phone layout: the preview fills the screen and a thumbnail strip switches the selected item. */
export function MobilePreview({ items, selectedId, dressedIds, bodyShape, onSelect, children }: Props) {
  const { t } = useTranslation()
  const [hintDismissed, setHintDismissed] = useState(false)
  return (
    <S.MobileWorkspace data-testid="item-editor-mobile">
      <S.MobilePreviewArea>{children}</S.MobilePreviewArea>
      {!hintDismissed && (
        <S.MobileHint data-testid="mobile-hint">
          <DesktopIcon fontSize="small" />
          <span>{t('item_editor.mobile_hint')}</span>
          <button
            type="button"
            aria-label={t('modal.close')}
            data-testid="mobile-hint-dismiss"
            onClick={() => setHintDismissed(true)}
          >
            <CloseIcon fontSize="small" />
          </button>
        </S.MobileHint>
      )}
      <S.Strip role="listbox" aria-label={t('item_editor.sidebar.items')} data-testid="mobile-strip">
        {items.map(item => {
          const available = hasRepresentationFor(item, bodyShape)
          const thumbnail = item.contents[item.thumbnail]
          return (
            <S.StripItem
              key={item.id}
              type="button"
              role="option"
              aria-selected={item.id === selectedId}
              aria-label={item.name}
              title={item.name}
              data-selected={item.id === selectedId || undefined}
              data-dressed={dressedIds.includes(item.id) || undefined}
              data-unavailable={!available || undefined}
              data-testid={`mobile-strip-item-${item.id}`}
              onClick={() => onSelect(item)}
            >
              <ItemThumbnail src={thumbnail ? getContentsStorageUrl(thumbnail) : null} rarity={item.rarity} />
            </S.StripItem>
          )
        })}
      </S.Strip>
    </S.MobileWorkspace>
  )
}

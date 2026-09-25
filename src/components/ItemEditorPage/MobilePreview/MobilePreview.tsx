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
  /** Tapping a thumbnail puts the item on the avatar, or takes it off when it is already on. */
  onTap: (item: Item) => void
  /** The avatar preview with its overlay controls. */
  children: ReactNode
  /** A bar above the preview (the curator's review bar). */
  header?: ReactNode
  /** Scrollable content under the strip (the selected item's properties in review mode). */
  details?: ReactNode
}

/**
 * Phone layout: the preview fills the screen and a thumbnail strip is the only item control, so each
 * thumbnail is a toggle — there is no dress button as on desktop.
 */
export function MobilePreview({ items, selectedId, dressedIds, bodyShape, onTap, children, header, details }: Props) {
  const { t } = useTranslation()
  const [hintDismissed, setHintDismissed] = useState(false)
  return (
    <S.MobileWorkspace data-testid="item-editor-mobile" data-details={details ? '' : undefined}>
      {header}
      <S.MobilePreviewArea>{children}</S.MobilePreviewArea>
      {!hintDismissed && !details && (
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
      <S.Strip role="group" aria-label={t('item_editor.sidebar.items')} data-testid="mobile-strip">
        {items.map(item => {
          const available = hasRepresentationFor(item, bodyShape)
          const dressed = dressedIds.includes(item.id)
          const thumbnail = item.contents[item.thumbnail]
          return (
            <S.StripItem
              key={item.id}
              type="button"
              aria-pressed={dressed}
              aria-current={item.id === selectedId || undefined}
              aria-label={t(dressed ? 'item_editor.sidebar.undress' : 'item_editor.sidebar.dress', {
                name: item.name
              })}
              title={item.name}
              data-selected={item.id === selectedId || undefined}
              data-dressed={dressed || undefined}
              data-unavailable={!available || undefined}
              data-testid={`mobile-strip-item-${item.id}`}
              onClick={() => onTap(item)}
            >
              <ItemThumbnail src={thumbnail ? getContentsStorageUrl(thumbnail) : null} rarity={item.rarity} />
            </S.StripItem>
          )
        })}
      </S.Strip>
      {details && <S.MobileDetails data-testid="mobile-details">{details}</S.MobileDetails>}
    </S.MobileWorkspace>
  )
}

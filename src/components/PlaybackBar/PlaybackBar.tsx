import { useMemo } from 'react'
import { PreviewEmote, type IPreviewController } from '@dcl/schemas'
import { Bookmark as CollectionIcon, Stop as StopIcon } from '@mui/icons-material'
import { EmoteControls } from '~/components/PreviewControls'
import { Select } from '~/components/Select'
import { Tooltip } from '~/components/Tooltip'
import { useMediaQuery } from '~/hooks/useMediaQuery'
import { useTranslation } from '~/intl'
import { ItemType, type Item } from '~/lib/items'
import { useAvatarPreview } from '~/store/avatarPreview'
import { theme } from '~/styles/theme'
import * as S from './PlaybackBar.styles'

type Props = {
  previewId: string
  controller: IPreviewController | null
  /** The collection's emotes, offered next to the default animations. */
  collectionEmotes: Item[]
  /** When an emote item is the subject, ui2's scrubber controls replace the play/stop bar. */
  subjectEmoteId: string | null
  testId?: string
}

// Idle is the resting pose, not an emote to pick: "nothing playing" is the empty state of the picker.
const DEFAULT_EMOTES = Object.values(PreviewEmote).filter(
  (value): value is PreviewEmote => typeof value === 'string' && value !== PreviewEmote.IDLE
)

/**
 * Picks and plays an emote on the avatar, a default one or one of the collection's. Stop returns the
 * avatar to its idle pose, and is the only way out of an emote preview on a phone, where the sidebar's
 * undress button is not there.
 */
export function PlaybackBar({
  previewId,
  controller,
  collectionEmotes,
  subjectEmoteId,
  testId = 'playback-bar'
}: Props) {
  const { t } = useTranslation()
  const isMobile = useMediaQuery(theme.media.maxWidth('mobile'))
  const emote = useAvatarPreview(state => state.emote)
  const dressedItemIds = useAvatarPreview(state => state.dressedItemIds)
  const setEmote = useAvatarPreview(state => state.setEmote)
  const dress = useAvatarPreview(state => state.dress)
  const undress = useAvatarPreview(state => state.undress)

  const dressedEmote = useMemo(
    () => collectionEmotes.find(item => dressedItemIds.includes(item.id)) ?? null,
    [collectionEmotes, dressedItemIds]
  )
  const options = useMemo(
    () => [
      ...collectionEmotes.map(item => ({
        value: item.id,
        label: item.name,
        trailing: (
          <Tooltip content={t('item_editor.playback.from_collection')} asChild testId={`${testId}-from-collection`}>
            <S.CollectionBadge data-icon-badge tabIndex={0} aria-label={t('item_editor.playback.from_collection')}>
              <CollectionIcon />
            </S.CollectionBadge>
          </Tooltip>
        )
      })),
      ...DEFAULT_EMOTES.map((value, index) => ({
        value: value,
        label: t(`item_editor.playback.emote.${value}`),
        // The first default emote opens the second group.
        dividerBefore: index === 0 && collectionEmotes.length > 0
      }))
    ],
    [collectionEmotes, t, testId]
  )

  function select(value: string) {
    const collectionEmote = collectionEmotes.find(item => item.id === value)
    if (collectionEmote) {
      dress({ id: collectionEmote.id, type: ItemType.EMOTE })
      return
    }
    if (dressedEmote) undress(dressedEmote.id)
    setEmote(value as PreviewEmote)
  }

  function stop() {
    if (dressedEmote) undress(dressedEmote.id)
    setEmote(PreviewEmote.IDLE)
    void controller?.emote.stop().catch(() => undefined)
  }

  const stopButton = (
    <Tooltip content={t('item_editor.playback.stop')} asChild testId={`${testId}-stop-tooltip`}>
      <S.StopControl
        type="button"
        aria-label={t('item_editor.playback.stop')}
        data-testid={`${testId}-stop`}
        onClick={stop}
      >
        <StopIcon fontSize="small" />
      </S.StopControl>
    </Tooltip>
  )

  if (subjectEmoteId) {
    return (
      <S.EmoteControlsWrap data-testid={`${testId}-emote-controls`}>
        {/* The frame counter is what gives way when the row has to fit a phone. */}
        <EmoteControls key={subjectEmoteId} wearablePreviewId={previewId} hideFrameInput={isMobile} />
        {stopButton}
      </S.EmoteControlsWrap>
    )
  }

  const isEmoteActive = emote !== PreviewEmote.IDLE || dressedEmote !== null

  return (
    <S.Wrap data-testid={testId} data-playing={isEmoteActive || undefined}>
      <Select
        value={dressedEmote?.id ?? (isEmoteActive ? emote : null)}
        options={options}
        placeholder={t('item_editor.playback.placeholder')}
        ariaLabel={t('item_editor.playback.select')}
        tone="dark"
        testId={`${testId}-select`}
        onChange={select}
      />
      {isEmoteActive && (
        <S.StopButton type="button" data-testid={`${testId}-stop`} onClick={stop}>
          <StopIcon fontSize="small" />
          {t('item_editor.playback.stop')}
        </S.StopButton>
      )}
    </S.Wrap>
  )
}

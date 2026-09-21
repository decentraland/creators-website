import { beforeEach, describe, expect, it, vi } from 'vitest'
import { type ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PreviewEmote, type IPreviewController } from '@dcl/schemas'
import { TranslationProvider } from '~/intl'
import { ItemType, type Item } from '~/lib/items'
import { useAvatarPreview } from '~/store/avatarPreview'
import { PlaybackBar } from './PlaybackBar'

// ui2's scrubber lazy-loads MUI and talks to an iframe; the bar's own controls are what's under test.
vi.mock('~/components/PreviewControls', () => ({
  EmoteControls: () => <div data-testid="ui2-emote-controls" />
}))

const emote = (id: string): Item =>
  ({
    id,
    name: id,
    type: ItemType.EMOTE,
    data: { representations: [] },
    contents: {}
  }) as unknown as Item

const dance = emote('dance-item')
const wrapper = ({ children }: { children: ReactNode }) => <TranslationProvider>{children}</TranslationProvider>

function makeController() {
  const stop = vi.fn().mockResolvedValue(undefined)
  return { stop, controller: { emote: { stop } } as unknown as IPreviewController }
}

/** Mirrors the editor: whichever collection emote is on the avatar becomes the preview's subject. */
function Bar({ controller }: { controller: IPreviewController }) {
  const dressedItemIds = useAvatarPreview(state => state.dressedItemIds)
  const subject = [dance].find(item => dressedItemIds.includes(item.id)) ?? null
  return (
    <PlaybackBar
      previewId="preview"
      controller={controller}
      collectionEmotes={[dance]}
      subjectEmoteId={subject?.id ?? null}
    />
  )
}

describe('PlaybackBar', () => {
  beforeEach(() => {
    useAvatarPreview.getState().clearDressed()
    useAvatarPreview.getState().setEmote(PreviewEmote.IDLE)
  })

  it('plays a collection emote and stops it again, back to the picker', async () => {
    const { stop, controller } = makeController()
    render(<Bar controller={controller} />, { wrapper })

    await userEvent.click(screen.getByTestId('playback-bar-select'))
    await userEvent.click(screen.getByTestId('playback-bar-select-option-dance-item'))
    expect(useAvatarPreview.getState().dressedItemIds).toEqual(['dance-item'])
    expect(screen.getByTestId('ui2-emote-controls')).toBeInTheDocument()

    await userEvent.click(screen.getByTestId('playback-bar-stop'))
    expect(stop).toHaveBeenCalled()
    expect(useAvatarPreview.getState().dressedItemIds).toEqual([])
    expect(screen.getByTestId('playback-bar-select')).toBeInTheDocument()
  })

  it('stops a default animation and offers it again', async () => {
    const { stop, controller } = makeController()
    render(<Bar controller={controller} />, { wrapper })

    await userEvent.click(screen.getByTestId('playback-bar-select'))
    await userEvent.click(screen.getByTestId('playback-bar-select-option-wave'))
    expect(useAvatarPreview.getState().emote).toBe(PreviewEmote.WAVE)

    await userEvent.click(screen.getByTestId('playback-bar-stop'))
    expect(stop).toHaveBeenCalled()
    expect(useAvatarPreview.getState().emote).toBe(PreviewEmote.IDLE)
    expect(screen.queryByTestId('playback-bar-stop')).not.toBeInTheDocument()
  })

  it('keeps working when the preview has no controller yet', async () => {
    render(
      <PlaybackBar previewId="preview" controller={null} collectionEmotes={[dance]} subjectEmoteId="dance-item" />,
      { wrapper }
    )
    useAvatarPreview.getState().dress({ id: dance.id, type: ItemType.EMOTE })

    await userEvent.click(screen.getByTestId('playback-bar-stop'))
    expect(useAvatarPreview.getState().dressedItemIds).toEqual([])
  })
})

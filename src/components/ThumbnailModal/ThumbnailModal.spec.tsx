import { describe, expect, it, vi } from 'vitest'
import { type ReactNode } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TranslationProvider } from '~/intl'
import { THUMBNAIL_PATH } from '~/lib/itemFiles'
import { ItemType } from '~/lib/items'
import { ThumbnailModal } from './ThumbnailModal'

// jsdom has no canvas: resizing hands back a fixed PNG data URL.
const PNG_DATA_URL = 'data:image/png;base64,iVBORw0KGgo='
vi.mock('~/lib/media', async importOriginal => ({
  ...(await importOriginal<typeof import('~/lib/media')>()),
  getImageType: vi.fn().mockResolvedValue('png'),
  resizeImage: vi.fn().mockResolvedValue(new Blob(['png'], { type: 'image/png' })),
  blobToDataURL: vi.fn().mockResolvedValue('data:image/png;base64,iVBORw0KGgo=')
}))

function renderModal() {
  const onSave = vi.fn()
  const wrapper = ({ children }: { children: ReactNode }) => <TranslationProvider>{children}</TranslationProvider>
  render(<ThumbnailModal type={ItemType.WEARABLE} contents={null} onSave={onSave} onClose={vi.fn()} />, {
    wrapper
  })
  return { onSave }
}

describe('ThumbnailModal', () => {
  it('lets a picture be uploaded while the item files and preview are still loading', async () => {
    const { onSave } = renderModal()
    expect(screen.getByTestId('thumbnail-loading')).toBeInTheDocument()
    expect(screen.getByTestId('thumbnail-capture')).toBeDisabled()
    expect(screen.getByTestId('thumbnail-upload')).toBeEnabled()

    await userEvent.upload(
      screen.getByTestId('thumbnail-file-input'),
      new File(['png'], 'thumb.png', { type: 'image/png' })
    )

    await waitFor(() => expect(onSave).toHaveBeenCalled())
    const [patch] = onSave.mock.calls[0]
    expect(patch.thumbnail).toBe(PNG_DATA_URL)
    expect(patch.contents[THUMBNAIL_PATH]).toBeInstanceOf(Blob)
  })
})

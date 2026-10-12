import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { TranslationProvider } from '~/intl'
import { PreviewCollectionButton } from './PreviewCollectionButton'

const previewCollection = vi.hoisted(() => vi.fn())
vi.mock('~/lib/explorer', () => ({ previewCollection }))

function renderButton(onLaunch = vi.fn()) {
  render(
    <TranslationProvider>
      <PreviewCollectionButton collectionId="c1" onLaunch={onLaunch} data-testid="preview" />
    </TranslationProvider>
  )
  return onLaunch
}

beforeEach(() => {
  previewCollection.mockReset()
})

describe('PreviewCollectionButton', () => {
  it('shows it is busy while the launch settles, then reports whether the explorer opened', async () => {
    let settle!: (launched: boolean) => void
    previewCollection.mockReturnValue(new Promise<boolean>(resolve => (settle = resolve)))
    const onLaunch = renderButton()

    fireEvent.click(screen.getByTestId('preview'))
    expect(previewCollection).toHaveBeenCalledWith('c1')
    expect(screen.getByTestId('preview')).toHaveAttribute('aria-busy', 'true')

    settle(false)
    await waitFor(() => expect(screen.getByTestId('preview')).not.toHaveAttribute('aria-busy'))
    expect(onLaunch).toHaveBeenCalledWith(false)
  })
})

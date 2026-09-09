import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThumbnailMosaic } from './ThumbnailMosaic'

describe('ThumbnailMosaic', () => {
  it('renders one cell per thumbnail, capped at four, and exposes the count for the layout', () => {
    render(<ThumbnailMosaic thumbnails={['a.png', 'b.png', 'c.png', 'd.png', 'e.png'].map(url => ({ url }))} />)
    expect(screen.getAllByTestId('thumbnail-mosaic-cell')).toHaveLength(4)
    expect(screen.getByTestId('thumbnail-mosaic')).toHaveAttribute('data-count', '4')
  })

  it('tints each cell with its item rarity', () => {
    render(<ThumbnailMosaic thumbnails={[{ url: 'a.png', rarity: 'mythic' }, { url: 'b.png' }]} />)
    const [mythic, plain] = screen.getAllByTestId('thumbnail-mosaic-thumbnail')
    expect(mythic).toHaveAttribute('data-rarity', 'mythic')
    expect(plain).not.toHaveAttribute('data-rarity')
  })

  it('shows a skeleton instead of cells while loading', () => {
    render(<ThumbnailMosaic thumbnails={[]} loading />)
    expect(screen.getByTestId('thumbnail-mosaic-loading')).toBeInTheDocument()
    expect(screen.queryByTestId('thumbnail-mosaic-cell')).not.toBeInTheDocument()
  })
})

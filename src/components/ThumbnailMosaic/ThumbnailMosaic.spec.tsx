import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThumbnailMosaic } from './ThumbnailMosaic'

describe('ThumbnailMosaic', () => {
  it('renders one cell per thumbnail, capped at four, and exposes the count for the layout', () => {
    render(<ThumbnailMosaic thumbnails={['a.png', 'b.png', 'c.png', 'd.png', 'e.png']} />)
    expect(screen.getAllByTestId('thumbnail-mosaic-cell')).toHaveLength(4)
    expect(screen.getByTestId('thumbnail-mosaic')).toHaveAttribute('data-count', '4')
  })

  it('shows a skeleton instead of cells while loading', () => {
    render(<ThumbnailMosaic thumbnails={[]} loading />)
    expect(screen.getByTestId('thumbnail-mosaic-loading')).toBeInTheDocument()
    expect(screen.queryByTestId('thumbnail-mosaic-cell')).not.toBeInTheDocument()
  })
})

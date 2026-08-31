import { describe, it, expect } from 'vitest'
import { pageWindow } from './pagination'

describe('pageWindow', () => {
  it('lists every page when there are five or fewer', () => {
    expect(pageWindow(1, 1)).toEqual([1])
    expect(pageWindow(2, 3)).toEqual([1, 2, 3])
    expect(pageWindow(5, 5)).toEqual([1, 2, 3, 4, 5])
  })

  it('centres the window on the current page', () => {
    expect(pageWindow(5, 9)).toEqual([3, 4, 5, 6, 7])
  })

  it('clamps the window at both ends', () => {
    expect(pageWindow(1, 9)).toEqual([1, 2, 3, 4, 5])
    expect(pageWindow(9, 9)).toEqual([5, 6, 7, 8, 9])
  })
})

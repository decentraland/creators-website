import { beforeEach, describe, expect, it } from 'vitest'
import { clearTopUpResume, parseTopUpReturn, readTopUpResume, saveTopUpResume, stripTopUpReturn } from './creditsTopUp'

const resume = { collectionId: 'c1', orderId: 'order-1', paymentMethod: 'credits' as const, termsAccepted: true }

beforeEach(() => sessionStorage.clear())

describe('the top-up hand-off record', () => {
  it('survives a round trip through session storage', () => {
    saveTopUpResume(resume)
    expect(readTopUpResume()).toEqual(resume)
  })

  it('is gone once cleared, and absent on a fresh visit', () => {
    saveTopUpResume(resume)
    clearTopUpResume()
    expect(readTopUpResume()).toBeNull()
  })

  it('ignores a record it cannot trust', () => {
    sessionStorage.setItem('wemotes-builder.credits-top-up', 'not json')
    expect(readTopUpResume()).toBeNull()
    sessionStorage.setItem('wemotes-builder.credits-top-up', JSON.stringify({ collectionId: 'c1' }))
    expect(readTopUpResume()).toBeNull()
    sessionStorage.setItem(
      'wemotes-builder.credits-top-up',
      JSON.stringify({ ...resume, paymentMethod: 'cash', termsAccepted: 'yes' })
    )
    expect(readTopUpResume()).toEqual({ ...resume, paymentMethod: null, termsAccepted: false })
  })
})

describe('the Stripe return query', () => {
  it('reads the order and whether the buyer backed out', () => {
    expect(parseTopUpReturn(new URLSearchParams('order=order-1'))).toEqual({ orderId: 'order-1', canceled: false })
    expect(parseTopUpReturn(new URLSearchParams('order=order-1&canceled=1'))).toEqual({
      orderId: 'order-1',
      canceled: true
    })
    expect(parseTopUpReturn(new URLSearchParams('page=2'))).toBeNull()
  })

  it('strips only its own params', () => {
    expect(stripTopUpReturn(new URLSearchParams('page=2&order=order-1&canceled=1')).toString()).toBe('page=2')
  })
})

import { describe, expect, it, vi } from 'vitest'
import { type ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { TranslationProvider } from '~/intl'
import { type Session } from '~/lib/auth'
import { type Collection } from '~/lib/collections'
import { type Item } from '~/lib/items'
import { type ThirdParty } from '~/lib/thirdParty'
import { LinkedApprovalFlowModal } from './LinkedApprovalFlowModal'

const withVideo = [
  { id: 'i1', name: 'Gold Hat' },
  { id: 'i2', name: 'Silver Hat' }
] as Item[]

vi.mock('~/hooks/useLinkedReview', () => ({
  useLinkedApprovalFlow: () => ({
    view: { kind: 'error', step: 'has_video', failed: [], items: withVideo },
    plan: null,
    steps: [],
    running: false,
    start: vi.fn(),
    runRoot: vi.fn(),
    runDeploy: vi.fn(),
    stop: vi.fn()
  })
}))

const wrapper = ({ children }: { children: ReactNode }) => <TranslationProvider>{children}</TranslationProvider>

describe('LinkedApprovalFlowModal', () => {
  it('names the items whose preview video blocks the approval, before anything goes on chain', () => {
    render(
      <LinkedApprovalFlowModal
        session={{ address: '0xcurator' } as unknown as Session}
        collection={{ id: 'c1', name: 'Brand Hats' } as Collection}
        thirdParty={{ id: 'urn:tp' } as ThirdParty}
        review={{ pendingIds: new Set(), reviewedHashes: new Map() }}
        onClose={vi.fn()}
      />,
      { wrapper }
    )
    const dialog = screen.getByTestId('approval-has-video')
    expect(dialog).toHaveTextContent('Gold Hat, Silver Hat')
    expect(dialog).toHaveTextContent('Nothing was put on chain')
  })
})

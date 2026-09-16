import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { type Friend } from '~/lib/friends'
import { BeneficiaryInput } from './BeneficiaryInput'
import { FRIEND, Providers } from './testUtils'

vi.stubGlobal(
  'fetch',
  vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ avatars: [{ name: 'Resolved', avatar: { snapshots: { face256: 'face.png' } } }] }), {
      status: 200
    })
  )
)

const friends: Friend[] = [
  { address: FRIEND, name: 'Blackbeard', hasClaimedName: true, avatarUrl: 'bb.png' },
  { address: '0x00000000000000000000000000000000000000dd', name: 'Anne Bonny', hasClaimedName: false, avatarUrl: '' }
]

type Props = Partial<Parameters<typeof BeneficiaryInput>[0]>

function renderInput(props: Props = {}) {
  const onChange = vi.fn()
  render(<BeneficiaryInput value="" onChange={onChange} friends={friends} isLoadingFriends={false} {...props} />, {
    wrapper: Providers
  })
  return { onChange }
}

describe('BeneficiaryInput', () => {
  it('lists friends from the chevron, not on focus, narrows them while typing, and picks one on click', async () => {
    const { onChange } = renderInput()
    await userEvent.click(screen.getByTestId('beneficiary-input'))
    expect(screen.queryByTestId('beneficiary-options')).not.toBeInTheDocument()
    await userEvent.click(screen.getByTestId('beneficiary-toggle'))
    expect(screen.getAllByTestId('beneficiary-option')).toHaveLength(2)

    await userEvent.type(screen.getByTestId('beneficiary-input'), 'black')
    const options = screen.getAllByTestId('beneficiary-option')
    expect(options).toHaveLength(1)
    expect(options[0]).toHaveTextContent('Blackbeard')

    await userEvent.click(options[0])
    expect(onChange).toHaveBeenCalledWith(FRIEND)
  })

  it('picks the highlighted friend with the keyboard and keeps Escape from reaching the dialog', async () => {
    const { onChange } = renderInput()
    const onKeyDown = vi.fn()
    document.addEventListener('keydown', onKeyDown)
    const input = screen.getByTestId('beneficiary-input')
    await userEvent.click(input)
    await userEvent.keyboard('{ArrowDown}{Enter}')
    expect(onChange).toHaveBeenCalledWith(friends[1].address)

    await userEvent.keyboard('{Escape}')
    expect(screen.queryByTestId('beneficiary-options')).not.toBeInTheDocument()
    expect(onKeyDown).not.toHaveBeenCalledWith(expect.objectContaining({ key: 'Escape' }))
    document.removeEventListener('keydown', onKeyDown)
  })

  it('says when nothing matches and while friends load', async () => {
    renderInput({ friends: undefined, isLoadingFriends: true })
    await userEvent.click(screen.getByTestId('beneficiary-toggle'))
    expect(screen.getByTestId('beneficiary-options')).toHaveTextContent(/loading/i)
  })

  it('shows a chosen friend with their name and avatar, and a pasted address with its profile name', async () => {
    const { rerender } = render(
      <BeneficiaryInput value={FRIEND} onChange={vi.fn()} friends={friends} isLoadingFriends={false} />,
      { wrapper: Providers }
    )
    expect(screen.getByTestId('beneficiary-name')).toHaveTextContent('Blackbeard')
    expect(screen.getByTestId('beneficiary-selected').querySelector('img')).toHaveAttribute('src', 'bb.png')

    const stranger = '0x00000000000000000000000000000000000000ee'
    rerender(<BeneficiaryInput value={stranger} onChange={vi.fn()} friends={friends} isLoadingFriends={false} />)
    expect(screen.getByTestId('beneficiary-name')).toHaveTextContent('0x0000…00ee')
    expect(await screen.findByText('Resolved')).toBeInTheDocument()
  })
})

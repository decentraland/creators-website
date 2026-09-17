import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BodyShape } from '@dcl/schemas'
import { TranslationProvider } from '~/intl'
import { getDefaultSpringBoneParams, type BoneNode } from '~/lib/springBones'
import { SpringBonesEditor } from './SpringBonesEditor'

const bones: BoneNode[] = [
  { name: 'Hips', nodeId: 0, type: 'avatar', children: [1, 3] },
  { name: 'Tail_springbone_1', nodeId: 1, type: 'spring', children: [2] },
  { name: 'Tail_springbone_2', nodeId: 2, type: 'spring', children: [] },
  { name: 'Hair_springbone', nodeId: 3, type: 'spring', children: [] }
]
const male = { hash: 'm', bodyShapes: [BodyShape.MALE], bones }
const female = { hash: 'f', bodyShapes: [BodyShape.FEMALE], bones }

describe('SpringBonesEditor', () => {
  it('lists configured chains, tunes their params and adds the remaining roots', async () => {
    const onChange = vi.fn()
    render(
      <SpringBonesEditor
        models={[male]}
        activeHash="m"
        onActiveHashChange={vi.fn()}
        params={{ Tail_springbone_1: getDefaultSpringBoneParams() }}
        onChange={onChange}
      />,
      { wrapper: TranslationProvider }
    )
    expect(screen.getByTestId('spring-bones-counter')).toHaveTextContent('2 / 12')
    fireEvent.change(screen.getByTestId('spring-bones-Tail_springbone_1-stiffness'), { target: { value: '3.5' } })
    expect(onChange).toHaveBeenLastCalledWith({ Tail_springbone_1: expect.objectContaining({ stiffness: 3.5 }) })
    await userEvent.click(screen.getByTestId('spring-bones-add'))
    await userEvent.click(screen.getByTestId('spring-bones-add-option-Hair_springbone'))
    expect(onChange).toHaveBeenLastCalledWith({
      Tail_springbone_1: expect.anything(),
      Hair_springbone: getDefaultSpringBoneParams()
    })
    await userEvent.click(screen.getByTestId('spring-bones-remove-Tail_springbone_1'))
    expect(onChange).toHaveBeenLastCalledWith({})
  })

  it('offers a body-shape tab pair for two-model items', async () => {
    const onActiveHashChange = vi.fn()
    render(
      <SpringBonesEditor
        models={[male, female]}
        activeHash="m"
        onActiveHashChange={onActiveHashChange}
        params={{}}
        onChange={vi.fn()}
      />,
      {
        wrapper: TranslationProvider
      }
    )
    await userEvent.click(screen.getByTestId('spring-bones-tab-female'))
    expect(onActiveHashChange).toHaveBeenCalledWith('f')
  })
})

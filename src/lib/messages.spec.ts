import { parse, TYPE, type MessageFormatElement } from '@formatjs/icu-messageformat-parser'
import { describe, expect, it } from 'vitest'
import { flattenMessages } from './messages'
import en from '~/intl/en.json'
import es from '~/intl/es.json'
import zh from '~/intl/zh.json'

// Argument and rich-text tag names a message references, including inside plural/select branches.
const argumentNames = (elements: MessageFormatElement[]): string[] =>
  elements.flatMap(element => {
    const own =
      'value' in element && typeof element.value === 'string' && element.type !== TYPE.literal ? [element.value] : []
    const nested = [
      ...('options' in element ? Object.values(element.options).flatMap(option => argumentNames(option.value)) : []),
      ...('children' in element ? argumentNames(element.children) : [])
    ]
    return [...own, ...nested]
  })

const argumentSet = (message: string) => [...new Set(argumentNames(parse(message)))].sort()

describe('flattenMessages', () => {
  it('flattens nested objects into dotted ids', () => {
    expect(
      flattenMessages({
        page: { title: 'Title', empty: { description: 'Nothing here' } },
        standalone: 'Alone'
      })
    ).toEqual({
      'page.title': 'Title',
      'page.empty.description': 'Nothing here',
      standalone: 'Alone'
    })
  })

  it('returns an empty map for an empty object', () => {
    expect(flattenMessages({})).toEqual({})
  })

  it.each([
    ['es', es],
    ['zh', zh]
  ])('keeps the %s key set in sync with en', (_, messages) => {
    expect(Object.keys(flattenMessages(messages)).sort()).toEqual(Object.keys(flattenMessages(en)).sort())
  })

  it.each([
    ['es', es],
    ['zh', zh]
  ])('keeps every %s message using the same arguments and tags as en', (_, messages) => {
    const english = flattenMessages(en)
    const mismatches = Object.entries(flattenMessages(messages)).filter(
      ([id, message]) => argumentSet(message).join() !== argumentSet(english[id] ?? '').join()
    )
    expect(mismatches).toEqual([])
  })
})

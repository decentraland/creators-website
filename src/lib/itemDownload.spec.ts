import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { buildItemZip, getItemZipName } from './itemDownload'
import { ItemType, type Item } from './items'

const item = { id: 'abc-1', name: 'My Hat!', type: ItemType.WEARABLE } as Item

describe('item download', () => {
  it('zips every stored file under its original path', async () => {
    const blob = await buildItemZip({ 'male/hat.glb': new Blob(['glb']), 'thumbnail.png': new Blob(['png']) })
    const zip = await JSZip.loadAsync(await blob.arrayBuffer())
    expect(Object.keys(zip.files).sort()).toEqual(['male/', 'male/hat.glb', 'thumbnail.png'])
    expect(await zip.file('male/hat.glb')!.async('text')).toBe('glb')
  })

  it('names the archive after the item', () => {
    expect(getItemZipName(item)).toBe('my-hat.zip')
    expect(getItemZipName({ ...item, name: '!!!' })).toBe('abc-1.zip')
  })
})

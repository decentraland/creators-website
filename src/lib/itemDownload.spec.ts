import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { buildItemZip, getItemZipName } from './itemDownload'
import { ItemType, type Item } from './items'

const item = { id: 'abc-1', name: 'My Hat!', type: ItemType.WEARABLE } as Item

/** Zips an item whose stored files are given as path → bytes; equal bytes are the same stored file. */
async function zipOf(stored: Record<string, string>): Promise<JSZip> {
  const contents = Object.fromEntries(Object.entries(stored).map(([path, bytes]) => [path, `hash-of-${bytes}`]))
  const files = Object.fromEntries(Object.entries(stored).map(([path, bytes]) => [path, new Blob([bytes])]))
  return JSZip.loadAsync(await (await buildItemZip({ contents }, files)).arrayBuffer())
}

const filesIn = (zip: JSZip) =>
  Object.values(zip.files)
    .filter(entry => !entry.dir)
    .map(entry => entry.name)
    .sort()

describe('item download', () => {
  it('ships the files once, at the root, when both body shapes hold the same ones', async () => {
    const zip = await zipOf({
      'male/hat.glb': 'glb',
      'male/textures/hat.png': 'texture',
      'male/sound.mp3': 'audio',
      'female/hat.glb': 'glb',
      'female/textures/hat.png': 'texture',
      'female/sound.mp3': 'audio',
      'thumbnail.png': 'thumb',
      'image.png': 'catalyst'
    })
    expect(filesIn(zip)).toEqual(['hat.glb', 'image.png', 'sound.mp3', 'textures/hat.png', 'thumbnail.png'])
    expect(await zip.file('hat.glb')!.async('text')).toBe('glb')
    expect(await zip.file('thumbnail.png')!.async('text')).toBe('thumb')
  })

  it('ships a smart wearable with its scene and code at the root, next to the video', async () => {
    const zip = await zipOf({
      'male/scene.json': 'scene',
      'male/bin/game.js': 'code',
      'male/glasses.glb': 'glb',
      'female/scene.json': 'scene',
      'female/bin/game.js': 'code',
      'female/glasses.glb': 'glb',
      'thumbnail.png': 'thumb',
      'image.png': 'catalyst',
      'video.mp4': 'video'
    })
    expect(filesIn(zip)).toEqual([
      'bin/game.js',
      'glasses.glb',
      'image.png',
      'scene.json',
      'thumbnail.png',
      'video.mp4'
    ])
  })

  it('keeps the folder of an item made for one body shape', async () => {
    const zip = await zipOf({ 'male/hat.glb': 'glb', 'thumbnail.png': 'thumb' })
    expect(filesIn(zip)).toEqual(['male/hat.glb', 'thumbnail.png'])
    expect(await zip.file('male/hat.glb')!.async('text')).toBe('glb')
  })

  it('keeps both folders when any file differs between the body shapes', async () => {
    const stored = {
      'male/shirt.glb': 'glb-m',
      'male/shirt.png': 'texture',
      'female/shirt.glb': 'glb-f',
      'female/shirt.png': 'texture',
      'thumbnail.png': 'thumb'
    }
    expect(filesIn(await zipOf(stored))).toEqual(Object.keys(stored).sort())
  })

  it('keeps both folders when one body shape has a file the other lacks', async () => {
    const stored = { 'male/hat.glb': 'glb', 'male/extra.png': 'texture', 'female/hat.glb': 'glb' }
    expect(filesIn(await zipOf(stored))).toEqual(Object.keys(stored).sort())
  })

  it('keeps both folders when the same file goes by a different name in each body shape', async () => {
    const stored = { 'male/long.glb': 'glb', 'female/short.glb': 'glb', 'thumbnail.png': 'thumb' }
    expect(filesIn(await zipOf(stored))).toEqual(Object.keys(stored).sort())
  })

  it('keeps both folders when a file would land on a root file of the same name', async () => {
    const stored = { 'male/thumbnail.png': 'texture', 'female/thumbnail.png': 'texture', 'thumbnail.png': 'thumb' }
    expect(filesIn(await zipOf(stored))).toEqual(Object.keys(stored).sort())
  })

  it('names the archive after the item', () => {
    expect(getItemZipName(item)).toBe('my-hat.zip')
    expect(getItemZipName({ ...item, name: '!!!' })).toBe('abc-1.zip')
  })
})

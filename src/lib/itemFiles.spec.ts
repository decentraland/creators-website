import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { BodyShapeType } from './items'
import {
  ItemFileError,
  cleanAssetName,
  cleanContentModelKeys,
  findOrphanedAuxiliaryFiles,
  getBodyShapeTypeFromContents,
  getExtension,
  getRequiredCounterpartFile,
  isModelPath,
  loadItemFile,
  stripWrappingFolder,
  toMB,
  validateVideoFile,
  MAX_VIDEO_FILE_SIZE
} from './itemFiles'

const blob = (size = 10) => new Blob([new Uint8Array(size)])

async function zipFile(entries: Record<string, string | Uint8Array | Blob>, name = 'item.zip'): Promise<File> {
  const zip = new JSZip()
  for (const [path, content] of Object.entries(entries)) {
    zip.file(path, content)
  }
  const buffer = await zip.generateAsync({ type: 'arraybuffer' })
  return new File([buffer], name)
}

async function expectItemFileError(promise: Promise<unknown>, messageKey: string) {
  try {
    await promise
    expect.fail('expected an ItemFileError')
  } catch (error) {
    expect(error).toBeInstanceOf(ItemFileError)
    expect((error as ItemFileError).messageKey).toBe(messageKey)
  }
}

describe('getExtension / cleanAssetName / toMB', () => {
  it('extracts the lowercased extension and cleans asset names', () => {
    expect(getExtension('Model.GLB')).toBe('.glb')
    expect(getExtension('no-extension')).toBeNull()
    expect(cleanAssetName('my_cool-hat.v2.glb')).toBe('my cool hat v2')
    expect(toMB(3 * 1024 * 1024)).toBe(3)
  })
})

describe('isModelPath', () => {
  it('accepts models and base textures but not thumbnails or auxiliary PNGs', () => {
    expect(isModelPath('model.glb')).toBe(true)
    expect(isModelPath('eyes.png')).toBe(true)
    expect(isModelPath('thumbnail.png')).toBe(false)
    expect(isModelPath('eyes_mask.png')).toBe(false)
    expect(isModelPath('eyes_expressions.png')).toBe(false)
  })
})

describe('auxiliary file pairing', () => {
  it('maps each auxiliary file to its required counterpart', () => {
    expect(getRequiredCounterpartFile('eyes_mask.png')).toBe('eyes.png')
    expect(getRequiredCounterpartFile('eyes_expressions.png')).toBe('eyes.png')
    expect(getRequiredCounterpartFile('eyes_expressions_mask.png')).toBe('eyes_expressions.png')
    expect(getRequiredCounterpartFile('eyes.png')).toBeNull()
  })

  it('finds orphans case-insensitively', () => {
    expect(findOrphanedAuxiliaryFiles({ 'Eyes.PNG': 1, 'eyes_mask.png': 1 })).toEqual([])
    expect(findOrphanedAuxiliaryFiles({ 'eyes_mask.png': 1 })).toEqual([
      { orphan: 'eyes_mask.png', expected: 'eyes.png' }
    ])
  })
})

describe('stripWrappingFolder', () => {
  it('unwraps a single wrapper folder recursively', () => {
    const result = stripWrappingFolder({ 'outer/inner/model.glb': blob(), 'outer/inner/tex.png': blob() })
    expect(Object.keys(result).sort()).toEqual(['model.glb', 'tex.png'])
  })

  it('never unwraps body-shape folders or mixed roots', () => {
    const bodyShaped = { 'male/model.glb': blob() }
    expect(stripWrappingFolder(bodyShaped)).toEqual(bodyShaped)
    const mixed = { 'a/x.glb': blob(), 'b/y.glb': blob() }
    expect(stripWrappingFolder(mixed)).toEqual(mixed)
  })
})

describe('getBodyShapeTypeFromContents / cleanContentModelKeys', () => {
  it('detects the body shape from folder prefixes', () => {
    expect(getBodyShapeTypeFromContents({ 'male/m.glb': 1, 'female/f.glb': 1 })).toBe(BodyShapeType.BOTH)
    expect(getBodyShapeTypeFromContents({ 'male/m.glb': 1 })).toBe(BodyShapeType.MALE)
    expect(getBodyShapeTypeFromContents({ 'm.glb': 1 })).toBeNull()
  })

  it('flattens model keys for a single shape and keeps them prefixed for both', () => {
    const contents = { 'male/model.glb': blob(), 'male/sound.mp3': blob() }
    expect(Object.keys(cleanContentModelKeys(contents)).sort()).toEqual(['male/sound.mp3', 'model.glb'])
    expect(Object.keys(cleanContentModelKeys(contents, BodyShapeType.BOTH)).sort()).toEqual([
      'male/model.glb',
      'male/sound.mp3'
    ])
  })
})

describe('loadItemFile', () => {
  it('rejects unsupported extensions', async () => {
    await expectItemFileError(loadItemFile(new File([blob()], 'file.txt')), 'wrong_extension')
  })

  it('wraps a bare model file as single-content with no fixed body shape', async () => {
    const result = await loadItemFile(new File([blob()], 'hat.glb'))
    expect(result.model).toBe('hat.glb')
    expect(result.bodyShape).toBeNull()
    expect(Object.keys(result.contents)).toEqual(['hat.glb'])
  })

  it('treats a bare PNG as an image wearable for both shapes', async () => {
    const result = await loadItemFile(new File([blob()], 'eyes.png'))
    expect(result.bodyShape).toBe(BodyShapeType.BOTH)
  })

  it('rejects files over the size cap', async () => {
    const big = new File([new Uint8Array(9 * 1024 * 1024)], 'huge.glb')
    await expectItemFileError(loadItemFile(big), 'file_too_big')
  })

  it('rejects a zip with too many entries', async () => {
    const entries: Record<string, string> = { 'model.glb': 'glb-bytes' }
    for (let index = 0; index < 500; index++) entries[`extra-${index}.png`] = 'x'
    await expectItemFileError(loadItemFile(await zipFile(entries)), 'too_many_files')
  })

  it('unzips a flat zip and finds the main model', async () => {
    const file = await zipFile({ 'model.glb': 'glb-bytes', 'texture.png': 'texture' })
    const result = await loadItemFile(file)
    expect(result.model).toBe('model.glb')
    expect(Object.keys(result.contents).sort()).toEqual(['model.glb', 'texture.png'])
  })

  it('strips a wrapping folder inside a zip', async () => {
    const file = await zipFile({ 'MyItem/model.glb': 'glb-bytes' })
    const result = await loadItemFile(file)
    expect(result.model).toBe('model.glb')
  })

  it('detects body-shape folders and flattens single-shape zips', async () => {
    const file = await zipFile({ 'female/model.glb': 'glb-bytes' })
    const result = await loadItemFile(file)
    expect(result.bodyShape).toBe(BodyShapeType.FEMALE)
    expect(result.model).toBe('model.glb')
    expect(Object.keys(result.contents)).toEqual(['model.glb'])
  })

  it('keeps both-shape zips prefixed', async () => {
    const file = await zipFile({ 'male/model.glb': 'm', 'female/model.glb': 'f' })
    const result = await loadItemFile(file)
    expect(result.bodyShape).toBe(BodyShapeType.BOTH)
    expect(Object.keys(result.contents).sort()).toEqual(['female/model.glb', 'male/model.glb'])
  })

  it('reads a wearable.json manifest and prefers its data', async () => {
    const manifest = {
      name: 'Cool Hat',
      rarity: 'legendary',
      data: {
        category: 'hat',
        replaces: [],
        hides: [],
        tags: ['cool'],
        representations: [
          {
            bodyShapes: ['urn:decentraland:off-chain:base-avatars:BaseMale'],
            mainFile: 'model.glb',
            contents: ['model.glb']
          }
        ]
      }
    }
    const file = await zipFile({ 'wearable.json': JSON.stringify(manifest), 'model.glb': 'glb-bytes' })
    const result = await loadItemFile(file)
    expect(result.wearable?.name).toBe('Cool Hat')
    expect(result.bodyShape).toBe(BodyShapeType.MALE)
    expect(result.model).toBe('model.glb')
    expect(result.contents['wearable.json']).toBeUndefined()
  })

  it('rejects a manifest that references missing files', async () => {
    const manifest = {
      name: 'Cool Hat',
      data: {
        category: 'hat',
        replaces: [],
        hides: [],
        tags: [],
        representations: [
          {
            bodyShapes: ['urn:decentraland:off-chain:base-avatars:BaseMale'],
            mainFile: 'missing.glb',
            contents: ['missing.glb']
          }
        ]
      }
    }
    const file = await zipFile({ 'wearable.json': JSON.stringify(manifest), 'model.glb': 'glb-bytes' })
    await expectItemFileError(loadItemFile(file), 'manifest_file_missing')
  })

  it('reads an emote.json manifest', async () => {
    const file = await zipFile({
      'emote.json': JSON.stringify({ name: 'Wave', play_mode: 'loop' }),
      'emote.glb': 'glb'
    })
    const result = await loadItemFile(file)
    expect(result.emote?.play_mode).toBe('loop')
    expect(result.bodyShape).toBe(BodyShapeType.BOTH)
  })

  it('rejects an emote.json manifest with wrongly typed fields', async () => {
    const file = await zipFile({ 'emote.json': JSON.stringify({ name: 42 }), 'emote.glb': 'glb' })
    await expectItemFileError(loadItemFile(file), 'invalid_manifest')
  })

  it('validates the wearable.json schema like the legacy builder-client', async () => {
    const manifest = (data: Record<string, unknown>) =>
      JSON.stringify({
        name: 'Hat',
        data: {
          category: 'hat',
          replaces: [],
          hides: [],
          tags: [],
          representations: [
            {
              bodyShapes: ['urn:decentraland:off-chain:base-avatars:BaseMale'],
              mainFile: 'model.glb',
              contents: ['model.glb']
            }
          ],
          ...data
        }
      })
    await expectItemFileError(
      loadItemFile(await zipFile({ 'wearable.json': manifest({ category: 'spaceship' }), 'model.glb': 'glb' })),
      'invalid_manifest'
    )
    await expectItemFileError(
      loadItemFile(await zipFile({ 'wearable.json': manifest({ tags: undefined }), 'model.glb': 'glb' })),
      'invalid_manifest'
    )
    await expectItemFileError(
      loadItemFile(
        await zipFile({
          'wearable.json': manifest({
            representations: [{ bodyShapes: ['urn:something:else'], mainFile: 'model.glb', contents: ['model.glb'] }]
          }),
          'model.glb': 'glb'
        })
      ),
      'invalid_manifest'
    )
    const result = await loadItemFile(await zipFile({ 'wearable.json': manifest({}), 'model.glb': 'glb' }))
    expect(result.bodyShape).toBe(BodyShapeType.MALE)
  })

  it('rejects an orphaned mask texture even when a wearable.json names the main file', async () => {
    const manifest = JSON.stringify({
      name: 'Eyes',
      data: {
        category: 'eyes',
        replaces: [],
        hides: [],
        tags: [],
        representations: [
          {
            bodyShapes: ['urn:decentraland:off-chain:base-avatars:BaseMale'],
            mainFile: 'eyes.png',
            contents: ['eyes.png']
          }
        ]
      }
    })
    await expectItemFileError(
      loadItemFile(await zipFile({ 'wearable.json': manifest, 'eyes.png': 'png', 'other_mask.png': 'png' })),
      'orphaned_auxiliary_file'
    )
  })

  describe('smart wearables', () => {
    const wearableManifest = JSON.stringify({
      name: 'Glasses',
      data: {
        category: 'eyewear',
        replaces: [],
        hides: [],
        tags: [],
        representations: [
          {
            bodyShapes: ['urn:decentraland:off-chain:base-avatars:BaseMale'],
            mainFile: 'glasses.glb',
            contents: ['glasses.glb']
          }
        ]
      }
    })
    const scene = (overrides: Record<string, unknown> = {}) =>
      JSON.stringify({
        main: 'bin/game.js',
        scene: { parcels: ['0,0'], base: '0,0' },
        requiredPermissions: ['USE_FETCH', 'OPEN_EXTERNAL_LINK'],
        ...overrides
      })
    const files = { 'wearable.json': wearableManifest, 'glasses.glb': 'glb', 'bin/game.js': 'code' }

    it('loads the scene code, keeps a normalized scene.json and forces both body shapes', async () => {
      const result = await loadItemFile(await zipFile({ ...files, 'scene.json': scene() }))
      expect(result.scene?.main).toBe('bin/game.js')
      expect(result.scene?.requiredPermissions).toEqual(['USE_FETCH', 'OPEN_EXTERNAL_LINK'])
      expect(Object.keys(result.contents).sort()).toEqual(['bin/game.js', 'glasses.glb', 'scene.json'])
      expect(JSON.parse(await result.contents['scene.json'].text())).toMatchObject({ main: 'bin/game.js' })
      expect(result.bodyShape).toBe(BodyShapeType.BOTH)
    })

    it('accepts a scene.json without wearable.json, preferring the 3D model over loose PNGs', async () => {
      const result = await loadItemFile(
        await zipFile({
          'scene.json': scene(),
          'menupic.png': 'png',
          'model.glb': 'glb',
          'bin/game.js': 'code',
          'asset.json': '{}'
        })
      )
      expect(result.wearable).toBeUndefined()
      expect(result.scene?.requiredPermissions).toEqual(['USE_FETCH', 'OPEN_EXTERNAL_LINK'])
      expect(result.model).toBe('model.glb')
      expect(result.bodyShape).toBe(BodyShapeType.BOTH)
      expect(Object.keys(result.contents).sort()).toEqual([
        'asset.json',
        'bin/game.js',
        'menupic.png',
        'model.glb',
        'scene.json'
      ])
    })

    it('finds the scene.json of a zipped project folder', async () => {
      const result = await loadItemFile(
        await zipFile({ 'my-sw/scene.json': scene(), 'my-sw/model.glb': 'glb', 'my-sw/bin/game.js': 'code' })
      )
      expect(result.scene?.main).toBe('bin/game.js')
      expect(Object.keys(result.contents).sort()).toEqual(['bin/game.js', 'model.glb', 'scene.json'])
    })

    it('keeps a bundled video.mp4 without counting it toward the size cap', async () => {
      const result = await loadItemFile(
        await zipFile({
          'scene.json': scene(),
          'model.glb': 'glb',
          'bin/game.js': 'code',
          'video.mp4': blob(3 * 1024 * 1024)
        })
      )
      expect(result.contents['video.mp4']).toBeDefined()
    })

    it('still needs the code bundle when there is no wearable.json', async () => {
      const file = await zipFile({ 'scene.json': scene(), 'model.glb': 'glb' })
      await expectItemFileError(loadItemFile(file), 'manifest_file_missing')
    })

    it('needs the file scene.main points at', async () => {
      const file = await zipFile({ ...files, 'scene.json': scene({ main: 'bin/index.js' }) })
      await expectItemFileError(loadItemFile(file), 'manifest_file_missing')
    })

    it('rejects unknown, duplicated and hostname-less permissions with their own errors', async () => {
      await expectItemFileError(
        loadItemFile(await zipFile({ ...files, 'scene.json': scene({ requiredPermissions: ['FLY'] }) })),
        'unknown_required_permissions'
      )
      await expectItemFileError(
        loadItemFile(
          await zipFile({ ...files, 'scene.json': scene({ requiredPermissions: ['USE_FETCH', 'USE_FETCH'] }) })
        ),
        'duplicated_required_permissions'
      )
      await expectItemFileError(
        loadItemFile(
          await zipFile({ ...files, 'scene.json': scene({ requiredPermissions: ['ALLOW_MEDIA_HOSTNAMES'] }) })
        ),
        'allowed_media_hostnames_empty'
      )
    })

    it('rejects a scene.json missing its required fields', async () => {
      const file = await zipFile({ ...files, 'scene.json': JSON.stringify({ main: 'bin/game.js' }) })
      await expectItemFileError(loadItemFile(file), 'invalid_manifest')
    })

    it('keeps a preview video shipped in the zip as video.mp4, outside the model size cap', async () => {
      const result = await loadItemFile(
        await zipFile({ ...files, 'scene.json': scene(), 'media/showcase.mp4': blob(4 * 1024 * 1024) })
      )
      expect(Object.keys(result.contents).sort()).toEqual(['bin/game.js', 'glasses.glb', 'scene.json', 'video.mp4'])
      expect(result.contents['video.mp4'].size).toBe(4 * 1024 * 1024)
    })

    it('rejects a zip with more than one video', async () => {
      await expectItemFileError(
        loadItemFile(await zipFile({ ...files, 'scene.json': scene(), 'a.mp4': 'a', 'b.mp4': 'b' })),
        'multiple_videos'
      )
    })

    it('drops a stray video from a plain wearable zip', async () => {
      const result = await loadItemFile(await zipFile({ ...files, 'video.mp4': 'x' }))
      expect(Object.keys(result.contents).sort()).toEqual(['bin/game.js', 'glasses.glb'])
    })

    it('caps the model at the smart wearable size', async () => {
      const file = await zipFile({ ...files, 'glasses.glb': blob(3 * 1024 * 1024 + 1), 'scene.json': scene() })
      await expectItemFileError(loadItemFile(file), 'file_too_big')
    })
  })

  it('rejects zips whose only PNGs are orphaned auxiliaries', async () => {
    const file = await zipFile({ 'eyes.png': 'base', 'other_mask.png': 'mask' })
    await expectItemFileError(loadItemFile(file), 'orphaned_auxiliary_file')
  })

  it('rejects zips with no model at all', async () => {
    const file = await zipFile({ 'readme.txt': 'hello' })
    await expectItemFileError(loadItemFile(file), 'missing_model_file')
  })
})

describe('validateVideoFile', () => {
  it('accepts an mp4 under the cap and rejects other formats or oversized files', () => {
    expect(() => validateVideoFile(new File([blob()], 'clip.MP4'))).not.toThrow()
    expect(() => validateVideoFile(new File([blob()], 'clip.mov'))).toThrow(ItemFileError)
    try {
      validateVideoFile(new File([blob(MAX_VIDEO_FILE_SIZE + 1)], 'clip.mp4'))
      expect.fail('expected an ItemFileError')
    } catch (error) {
      expect((error as ItemFileError).messageKey).toBe('video_too_big')
    }
  })
})

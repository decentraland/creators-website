// The in-browser backend: loads the model with Three.js and runs the lib/glbValidation suite.
import { type WearableCategory } from '@dcl/schemas'
import { getContentsStorageUrl } from '../builder'
import { validateEmoteGLTF, validateWearableGLTF, ValidationSeverity } from '../glbValidation'
import { PROP_ARMATURE_NAME } from '../glbValidation/constants'
import { isImageFile } from '../itemFiles'
import { ItemType } from '../items'
import { loadGltf } from '../models'
import {
  type ItemValidator,
  type ValidateOptions,
  type ValidationContext,
  type ValidationEntry,
  type ValidationResult,
  type ValidationSource
} from './types'

class AbortedError extends Error {
  constructor() {
    super('Validation aborted')
    this.name = 'AbortError'
  }
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new AbortedError()
}

type Loadable = {
  mainFile: string
  /** Every file the loader may request, by path, as a fetchable URL. */
  mappings: Record<string, string>
  /** Content paths, for the checks that only need file names (audio formats). */
  paths: string[]
  release: () => void
}

function toLoadable(source: ValidationSource, ctx: ValidationContext): Loadable {
  if (source.kind === 'blob') {
    const mappings = Object.fromEntries(
      Object.entries(source.contents).map(([path, blob]) => [path, URL.createObjectURL(blob)])
    )
    return {
      mainFile: source.mainFile,
      mappings,
      paths: Object.keys(source.contents),
      release: () => Object.values(mappings).forEach(url => URL.revokeObjectURL(url))
    }
  }
  const { item } = source
  const representation =
    item.data.representations.find(candidate => ctx.bodyShape && candidate.bodyShapes.includes(ctx.bodyShape)) ??
    item.data.representations[0]
  if (!representation) throw new Error(`Item "${item.id}" has no representation to validate`)
  // The full mapping set: a .gltf's textures and buffers resolve through it, or the loader fails.
  const mappings = Object.fromEntries(
    Object.entries(item.contents).map(([path, hash]) => [path, getContentsStorageUrl(hash)])
  )
  return { mainFile: representation.mainFile, mappings, paths: Object.keys(item.contents), release: () => undefined }
}

async function validateOne(
  source: ValidationSource,
  ctx: ValidationContext,
  opts: ValidateOptions = {}
): Promise<ValidationResult> {
  throwIfAborted(opts.signal)
  const loadable = toLoadable(source, ctx)
  // Texture-only wearables have no geometry to inspect.
  if (isImageFile(loadable.mainFile)) {
    loadable.release()
    return { issues: [] }
  }
  try {
    const gltf = await loadGltf(loadable.mappings[loadable.mainFile], loadable.mappings)
    throwIfAborted(opts.signal)
    if (ctx.type === ItemType.EMOTE) {
      const hasProps = gltf.scene.children.some(child => child.name === PROP_ARMATURE_NAME)
      // The audio check only reads file names.
      const contents = Object.fromEntries(loadable.paths.map(path => [path, new Blob()]))
      const result = await validateEmoteGLTF(gltf, hasProps, contents)
      return { issues: result.issues }
    }
    const result = await validateWearableGLTF(gltf, ctx.category as WearableCategory | undefined, ctx.hides)
    return { issues: result.issues }
  } finally {
    loadable.release()
  }
}

export const localValidator: ItemValidator = {
  validate: validateOne,
  async validateMany(entries: ValidationEntry[], opts?: ValidateOptions) {
    const results: ValidationResult[] = []
    for (const entry of entries) results.push(await validateOne(entry.source, entry.ctx, opts))
    return results
  }
}

export function hasErrors(result: ValidationResult): boolean {
  return result.issues.some(issue => issue.severity === ValidationSeverity.ERROR)
}
